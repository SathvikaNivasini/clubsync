-- ============================================================================
-- ClubSync — helpers, guards and RPCs
-- ============================================================================
set search_path = clubsync, public, pg_temp;

create or replace function app_is_officer_of(p_club uuid)
returns boolean language sql stable security definer set search_path = clubsync, public, pg_temp as $$
  select exists (select 1 from officers o where o.club_id = p_club and o.id = auth.uid());
$$;

create or replace function app_is_member_of(p_club uuid)
returns boolean language sql stable security definer set search_path = clubsync, public, pg_temp as $$
  select exists (select 1 from club_memberships m where m.club_id = p_club and m.member_id = auth.uid());
$$;

create or replace function app_officer_club()
returns uuid language sql stable security definer set search_path = clubsync, public, pg_temp as $$
  select o.club_id from officers o where o.id = auth.uid();
$$;

-- Voting only works while the round is open AND before the deadline, whatever
-- code path writes the vote.
create or replace function app_guard_vote()
returns trigger language plpgsql security definer set search_path = clubsync, public, pg_temp as $$
declare v_status text; v_deadline timestamptz; v_club uuid;
begin
  select r.status, r.deadline, r.club_id into v_status, v_deadline, v_club
    from round_options o join rounds r on r.id = o.round_id
   where o.id = coalesce(new.option_id, old.option_id);
  if v_status is null then
    raise exception 'clubsync: that option no longer exists' using errcode = 'P0002';
  end if;
  if v_status <> 'open' or now() > v_deadline then
    raise exception 'clubsync: voting has closed' using errcode = '42501';
  end if;
  if not app_is_member_of(v_club) then
    raise exception 'clubsync: you are not in this club' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists votes_guard on votes;
create trigger votes_guard before insert or delete on votes
  for each row execute function app_guard_vote();

-- ---------------------------------------------------------------------------
-- OFFICER
-- ---------------------------------------------------------------------------
create or replace function officer_open_round(p_deadline timestamptz, p_options jsonb)
returns uuid language plpgsql volatile security definer set search_path = clubsync, public, pg_temp as $$
declare v_club uuid := app_officer_club(); v_round uuid; v_n int;
begin
  if v_club is null then raise exception 'clubsync: officers only' using errcode = '42501'; end if;
  if p_deadline <= now() then
    raise exception 'clubsync: the deadline has to be in the future' using errcode = '22023';
  end if;
  if jsonb_typeof(p_options) <> 'array' then
    raise exception 'clubsync: options must be a list' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_options);
  if v_n = 0 then raise exception 'clubsync: pick at least one time' using errcode = '22023'; end if;
  if v_n > 20 then raise exception 'clubsync: at most 20 times' using errcode = '22023'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_options) e
     where (e->>'date')::date < current_date
        or (e->>'slot') not in ('before_school','after_school')
  ) then
    raise exception 'clubsync: times must be in the future, before or after school' using errcode = '22023';
  end if;

  update rounds set status = 'closed' where club_id = v_club and status = 'open';

  insert into rounds (club_id, created_by, deadline) values (v_club, auth.uid(), p_deadline)
    returning id into v_round;

  insert into round_options (round_id, slot_date, slot)
  select v_round, (e->>'date')::date, e->>'slot' from jsonb_array_elements(p_options) e
  on conflict (round_id, slot_date, slot) do nothing;

  return v_round;
end;
$$;

-- Tally for the officer's current round. Counts only — never a voter id.
create or replace function officer_results()
returns table (round_id uuid, deadline timestamptz, closed boolean,
               option_id uuid, slot_date date, slot text,
               votes integer, total_members integer)
language plpgsql stable security definer set search_path = clubsync, public, pg_temp as $$
declare v_club uuid := app_officer_club();
begin
  if v_club is null then raise exception 'clubsync: officers only' using errcode = '42501'; end if;
  return query
  select r.id, r.deadline, (r.status <> 'open' or now() > r.deadline),
         o.id, o.slot_date, o.slot,
         (select count(*)::int from votes v where v.option_id = o.id),
         (select count(*)::int from club_memberships cm where cm.club_id = v_club)
    from rounds r join round_options o on o.round_id = r.id
   where r.club_id = v_club
     and r.id = (select r2.id from rounds r2 where r2.club_id = v_club order by r2.created_at desc limit 1)
   order by o.slot_date, o.slot;
end;
$$;

create or replace function officer_finalize(p_option uuid, p_location text default null)
returns uuid language plpgsql volatile security definer set search_path = clubsync, public, pg_temp as $$
declare v_club uuid := app_officer_club(); v_opt round_options; v_meeting uuid;
begin
  if v_club is null then raise exception 'clubsync: officers only' using errcode = '42501'; end if;
  select o.* into v_opt from round_options o join rounds r on r.id = o.round_id
   where o.id = p_option and r.club_id = v_club;
  if v_opt.id is null then
    raise exception 'clubsync: that option is not yours' using errcode = '42501';
  end if;
  begin
    insert into meetings (club_id, round_id, slot_date, slot, location)
    values (v_club, v_opt.round_id, v_opt.slot_date, v_opt.slot,
            nullif(btrim(coalesce(p_location, '')), ''))
    returning id into v_meeting;
  exception when unique_violation then
    raise exception 'clubsync: you already booked that time' using errcode = '42501';
  end;
  update rounds set status = 'closed' where id = v_opt.round_id;
  return v_meeting;
end;
$$;

create or replace function officer_cancel_meeting(p_meeting uuid)
returns void language plpgsql volatile security definer set search_path = clubsync, public, pg_temp as $$
declare v_club uuid := app_officer_club();
begin
  if v_club is null then raise exception 'clubsync: officers only' using errcode = '42501'; end if;
  delete from meetings where id = p_meeting and club_id = v_club;
end;
$$;

-- ---------------------------------------------------------------------------
-- STUDENT
-- ---------------------------------------------------------------------------
create or replace function member_ballots()
returns table (club_id uuid, club_name text, club_code text, round_id uuid, deadline timestamptz,
               closed boolean, option_id uuid, slot_date date, slot text, i_voted boolean)
language sql stable security definer set search_path = clubsync, public, pg_temp as $$
  select c.id, c.name, c.code, r.id, r.deadline, (r.status <> 'open' or now() > r.deadline),
         o.id, o.slot_date, o.slot,
         exists (select 1 from votes v where v.option_id = o.id and v.member_id = auth.uid())
    from club_memberships cm
    join clubs c on c.id = cm.club_id
    join rounds r on r.club_id = c.id and r.status = 'open'
    join round_options o on o.round_id = r.id
   where cm.member_id = auth.uid()
   order by r.deadline, c.name, o.slot_date, o.slot;
$$;

create or replace function member_vote(p_option uuid, p_on boolean)
returns boolean language plpgsql volatile security definer set search_path = clubsync, public, pg_temp as $$
begin
  if auth.uid() is null or not exists (select 1 from members m where m.id = auth.uid()) then
    raise exception 'clubsync: students only' using errcode = '42501';
  end if;
  if p_on then
    insert into votes (option_id, member_id) values (p_option, auth.uid())
    on conflict (option_id, member_id) do nothing;
  else
    delete from votes where option_id = p_option and member_id = auth.uid();
  end if;
  return p_on;
end;
$$;

create or replace function my_meetings(p_from date, p_to date)
returns table (meeting_id uuid, club_id uuid, club_name text, club_code text,
               slot_date date, slot text, location text)
language sql stable security definer set search_path = clubsync, public, pg_temp as $$
  select m.id, c.id, c.name, c.code, m.slot_date, m.slot, m.location
    from meetings m join clubs c on c.id = m.club_id
   where m.slot_date between p_from and p_to
     and (app_is_member_of(c.id) or app_is_officer_of(c.id))
   order by m.slot_date, m.slot;
$$;

create or replace function join_club(p_code text)
returns table (club_id uuid, club_name text, already boolean)
language plpgsql volatile security definer set search_path = clubsync, public, pg_temp as $$
declare v_club clubs; v_uid uuid := auth.uid(); v_already boolean;
begin
  if v_uid is null or not exists (select 1 from members m where m.id = v_uid) then
    raise exception 'clubsync: students only' using errcode = '42501';
  end if;
  select * into v_club from clubs c where c.code = upper(btrim(coalesce(p_code, '')));
  if v_club.id is null then
    raise exception 'clubsync: no club has that code' using errcode = 'P0002';
  end if;
  select exists (select 1 from club_memberships cm
                  where cm.club_id = v_club.id and cm.member_id = v_uid) into v_already;
  if not v_already then
    insert into club_memberships (club_id, member_id) values (v_club.id, v_uid);
  end if;
  return query select v_club.id, v_club.name, v_already;
end;
$$;
