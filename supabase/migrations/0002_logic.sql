-- ============================================================================
-- ClubSync v2 — helpers, guards and RPCs
-- ============================================================================
set search_path = clubsync, public, pg_temp;

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so policies can call them without recursion.
-- ---------------------------------------------------------------------------
create or replace function app_is_sponsor_of(p_club uuid)
returns boolean language sql stable security definer set search_path = clubsync, public, pg_temp as $$
  select exists (select 1 from club_sponsors cs where cs.club_id = p_club and cs.sponsor_id = auth.uid());
$$;

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

-- ---------------------------------------------------------------------------
-- Voting is only possible while the round is open AND before the deadline.
-- Enforced here so it holds no matter which code path writes the vote.
-- ---------------------------------------------------------------------------
create or replace function app_guard_vote()
returns trigger language plpgsql security definer set search_path = clubsync, public, pg_temp as $$
declare
  v_status text;
  v_deadline timestamptz;
  v_club uuid;
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
-- SPONSOR
-- ---------------------------------------------------------------------------

-- The clubs this sponsor runs, with how many slots they have offered.
create or replace function my_clubs()
returns table (club_id uuid, code text, name text)
language sql stable security definer set search_path = clubsync, public, pg_temp as $$
  select c.id, c.code, c.name
    from clubs c
    join club_sponsors cs on cs.club_id = c.id
   where cs.sponsor_id = auth.uid()
   order by c.name;
$$;

-- Toggle one slot on or off. Refuses to remove a slot a club already claimed.
create or replace function sponsor_toggle_slot(p_date date, p_slot text)
returns boolean
language plpgsql volatile security definer set search_path = clubsync, public, pg_temp as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not exists (select 1 from sponsors s where s.id = auth.uid()) then
    raise exception 'clubsync: sponsors only' using errcode = '42501';
  end if;
  if p_slot not in ('before_school', 'after_school') then
    raise exception 'clubsync: unknown slot' using errcode = '22023';
  end if;
  if p_date < current_date then
    raise exception 'clubsync: that date has passed' using errcode = '22023';
  end if;

  select id into v_id from sponsor_slots
   where sponsor_id = auth.uid() and slot_date = p_date and slot = p_slot;

  if v_id is null then
    insert into sponsor_slots (sponsor_id, slot_date, slot) values (auth.uid(), p_date, p_slot);
    return true;
  end if;

  if exists (select 1 from meetings m where m.sponsor_slot_id = v_id) then
    raise exception 'clubsync: a club already booked that slot' using errcode = '42501';
  end if;

  delete from sponsor_slots where id = v_id;
  return false;
end;
$$;

-- Everything the sponsor's calendar needs for a month, in one call.
create or replace function sponsor_calendar(p_from date, p_to date)
returns table (
  slot_date date,
  slot text,
  offered boolean,
  booked_by text,
  booked_club_code text
)
language sql stable security definer set search_path = clubsync, public, pg_temp as $$
  select s.slot_date, s.slot, true,
         c.name, c.code
    from sponsor_slots s
    left join meetings m on m.sponsor_slot_id = s.id
    left join clubs c on c.id = m.club_id
   where s.sponsor_id = auth.uid()
     and s.slot_date between p_from and p_to
   order by s.slot_date, s.slot;
$$;

-- ---------------------------------------------------------------------------
-- OFFICER
-- ---------------------------------------------------------------------------

-- The only slots an officer may ever use: what their sponsor offered.
-- Slots already claimed by another club come back flagged, not hidden, so the
-- officer can see why a time disappeared.
create or replace function officer_slots(p_from date, p_to date)
returns table (
  slot_id uuid,
  slot_date date,
  slot text,
  taken_by_club text,
  taken_by_us boolean
)
language plpgsql stable security definer set search_path = clubsync, public, pg_temp as $$
declare
  v_club uuid := app_officer_club();
begin
  if v_club is null then
    raise exception 'clubsync: officers only' using errcode = '42501';
  end if;

  return query
  select s.id, s.slot_date, s.slot,
         case when m.id is not null and m.club_id <> v_club then c.name end,
         coalesce(m.club_id = v_club, false)
    from sponsor_slots s
    join club_sponsors cs on cs.sponsor_id = s.sponsor_id and cs.club_id = v_club
    left join meetings m on m.sponsor_slot_id = s.id
    left join clubs c on c.id = m.club_id
   where s.slot_date between p_from and p_to
   order by s.slot_date, s.slot;
end;
$$;

-- Open a voting round on a chosen set of the sponsor's slots.
create or replace function officer_open_round(p_deadline timestamptz, p_slot_ids uuid[])
returns uuid
language plpgsql volatile security definer set search_path = clubsync, public, pg_temp as $$
declare
  v_club uuid := app_officer_club();
  v_round uuid;
  v_count int;
begin
  if v_club is null then
    raise exception 'clubsync: officers only' using errcode = '42501';
  end if;
  if p_deadline <= now() then
    raise exception 'clubsync: the deadline has to be in the future' using errcode = '22023';
  end if;
  if p_slot_ids is null or array_length(p_slot_ids, 1) is null then
    raise exception 'clubsync: pick at least one time' using errcode = '22023';
  end if;

  -- every slot must belong to this club's sponsor and still be free
  select count(*) into v_count
    from sponsor_slots s
    join club_sponsors cs on cs.sponsor_id = s.sponsor_id and cs.club_id = v_club
   where s.id = any(p_slot_ids)
     and not exists (select 1 from meetings m where m.sponsor_slot_id = s.id);

  if v_count <> array_length(p_slot_ids, 1) then
    raise exception 'clubsync: one of those times is no longer available' using errcode = '42501';
  end if;

  -- only one open round per club at a time
  update rounds set status = 'closed' where club_id = v_club and status = 'open';

  insert into rounds (club_id, created_by, deadline) values (v_club, auth.uid(), p_deadline)
    returning id into v_round;

  insert into round_options (round_id, sponsor_slot_id, slot_date, slot)
  select v_round, s.id, s.slot_date, s.slot from sponsor_slots s where s.id = any(p_slot_ids);

  return v_round;
end;
$$;

-- Vote counts for the officer's current round. Counts only — never a voter id.
create or replace function officer_results()
returns table (
  round_id uuid,
  deadline timestamptz,
  status text,
  closed boolean,
  option_id uuid,
  slot_date date,
  slot text,
  votes integer,
  total_members integer,
  taken_by_club text
)
language plpgsql stable security definer set search_path = clubsync, public, pg_temp as $$
declare
  v_club uuid := app_officer_club();
begin
  if v_club is null then
    raise exception 'clubsync: officers only' using errcode = '42501';
  end if;

  return query
  select r.id, r.deadline, r.status, (r.status <> 'open' or now() > r.deadline),
         o.id, o.slot_date, o.slot,
         (select count(*)::int from votes v where v.option_id = o.id),
         (select count(*)::int from club_memberships cm where cm.club_id = v_club),
         (select c2.name from meetings m2 join clubs c2 on c2.id = m2.club_id
           where m2.sponsor_slot_id = o.sponsor_slot_id and m2.club_id <> v_club)
    from rounds r
    join round_options o on o.round_id = r.id
   where r.club_id = v_club
     and r.id = (select r2.id from rounds r2 where r2.club_id = v_club order by r2.created_at desc limit 1)
   order by o.slot_date, o.slot;
end;
$$;

-- Finalise. The unique constraint on meetings.sponsor_slot_id is what makes
-- this first-come-first-served between clubs that share a sponsor.
create or replace function officer_finalize(p_option uuid, p_location text default null)
returns uuid
language plpgsql volatile security definer set search_path = clubsync, public, pg_temp as $$
declare
  v_club uuid := app_officer_club();
  v_opt round_options;
  v_meeting uuid;
begin
  if v_club is null then
    raise exception 'clubsync: officers only' using errcode = '42501';
  end if;

  select o.* into v_opt from round_options o
    join rounds r on r.id = o.round_id
   where o.id = p_option and r.club_id = v_club;

  if v_opt.id is null then
    raise exception 'clubsync: that option is not yours' using errcode = '42501';
  end if;

  begin
    insert into meetings (club_id, sponsor_slot_id, round_id, slot_date, slot, location)
    values (v_club, v_opt.sponsor_slot_id, v_opt.round_id, v_opt.slot_date, v_opt.slot,
            nullif(btrim(coalesce(p_location, '')), ''))
    returning id into v_meeting;
  exception when unique_violation then
    raise exception 'clubsync: another club booked that time first' using errcode = '42501';
  end;

  update rounds set status = 'closed' where id = v_opt.round_id;
  return v_meeting;
end;
$$;

create or replace function officer_cancel_meeting(p_meeting uuid)
returns void
language plpgsql volatile security definer set search_path = clubsync, public, pg_temp as $$
declare
  v_club uuid := app_officer_club();
begin
  if v_club is null then
    raise exception 'clubsync: officers only' using errcode = '42501';
  end if;
  delete from meetings where id = p_meeting and club_id = v_club;
end;
$$;

-- ---------------------------------------------------------------------------
-- STUDENT
-- ---------------------------------------------------------------------------

-- Open rounds across every club the student belongs to, with their own votes.
create or replace function member_ballots()
returns table (
  club_id uuid,
  club_name text,
  club_code text,
  round_id uuid,
  deadline timestamptz,
  closed boolean,
  option_id uuid,
  slot_date date,
  slot text,
  i_voted boolean
)
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
returns boolean
language plpgsql volatile security definer set search_path = clubsync, public, pg_temp as $$
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

-- Scheduled meetings for whichever clubs the caller can see.
create or replace function my_meetings(p_from date, p_to date)
returns table (
  meeting_id uuid,
  club_id uuid,
  club_name text,
  club_code text,
  slot_date date,
  slot text,
  location text
)
language sql stable security definer set search_path = clubsync, public, pg_temp as $$
  select m.id, c.id, c.name, c.code, m.slot_date, m.slot, m.location
    from meetings m
    join clubs c on c.id = m.club_id
   where m.slot_date between p_from and p_to
     and (
       app_is_member_of(c.id)
       or app_is_officer_of(c.id)
       or app_is_sponsor_of(c.id)
     )
   order by m.slot_date, m.slot;
$$;

-- ---------------------------------------------------------------------------
-- Students join a club with its short code. The code is the capability —
-- there is no public club directory.
-- ---------------------------------------------------------------------------
create or replace function join_club(p_code text)
returns table (club_id uuid, club_name text, already boolean)
language plpgsql volatile security definer set search_path = clubsync, public, pg_temp as $$
declare
  v_club clubs;
  v_uid uuid := auth.uid();
  v_already boolean;
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

create or replace function my_club_list()
returns table (club_id uuid, code text, name text)
language sql stable security definer set search_path = clubsync, public, pg_temp as $$
  select c.id, c.code, c.name
    from club_memberships cm join clubs c on c.id = cm.club_id
   where cm.member_id = auth.uid()
   order by c.name;
$$;
