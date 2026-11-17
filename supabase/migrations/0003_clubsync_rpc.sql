-- ============================================================================
-- ClubSync — RPCs
-- ============================================================================

set search_path = clubsync, public, pg_temp;
-- Member-facing RPCs run as the caller (SECURITY INVOKER) wherever RLS already
-- expresses the rule. Only two things need SECURITY DEFINER:
--   1. club lookup / join by code — the member cannot read `clubs` until they
--      are a member of it, so the code itself is the capability.
--   2. the leader analytics aggregates — they must read availability rows that
--      leaders deliberately have no row-level access to, and they return
--      counts only, never a member id.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Club discovery and joining
-- ---------------------------------------------------------------------------
create or replace function lookup_club_by_code(p_code text)
returns table (
  id uuid,
  code text,
  name text,
  description text,
  school text,
  accent_color text,
  member_count integer,
  already_member boolean
)
language plpgsql
stable
security definer
set search_path = clubsync, public, pg_temp
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if auth.uid() is null then
    raise exception 'clubsync: authentication required' using errcode = '28000';
  end if;
  if char_length(v_code) < 3 then
    return;
  end if;

  return query
  select c.id, c.code, c.name, c.description, c.school, c.accent_color,
         (select count(*)::integer from club_memberships cm where cm.club_id = c.id),
         exists (
           select 1 from club_memberships cm
           where cm.club_id = c.id and cm.member_id = auth.uid()
         )
    from clubs c
   where c.code = v_code
     and c.join_enabled;
end;
$$;

create or replace function join_club_with_code(p_code text)
returns table (club_id uuid, club_name text, member_number integer, was_new boolean)
language plpgsql
volatile
security definer
set search_path = clubsync, public, pg_temp
as $$
declare
  v_code   text := upper(btrim(coalesce(p_code, '')));
  v_club   clubs;
  v_uid    uuid := auth.uid();
  v_number integer;
  v_new    boolean := false;
begin
  if v_uid is null then
    raise exception 'clubsync: authentication required' using errcode = '28000';
  end if;
  if not exists (select 1 from members m where m.id = v_uid) then
    raise exception 'clubsync: only member accounts can join clubs' using errcode = '42501';
  end if;

  select * into v_club from clubs c where c.code = v_code and c.join_enabled;
  if v_club.id is null then
    raise exception 'clubsync: no club accepts that code' using errcode = 'P0002';
  end if;

  select cm.member_number into v_number
    from club_memberships cm
   where cm.club_id = v_club.id and cm.member_id = v_uid;

  if v_number is null then
    insert into club_memberships (club_id, member_id, member_number)
    values (v_club.id, v_uid, 0)
    returning club_memberships.member_number into v_number;
    v_new := true;

    insert into notifications (member_id, club_id, kind, title, body)
    values (v_uid, v_club.id, 'club_joined',
            'Joined ' || v_club.name,
            'You are Member #' || v_number || ' in ' || v_club.name ||
            '. Submit your availability so your leader can pick a time that works.');
  end if;

  return query select v_club.id, v_club.name, v_number, v_new;
end;
$$;

create or replace function leave_club(p_club uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = clubsync, public, pg_temp
as $$
begin
  delete from club_memberships cm
   where cm.club_id = p_club and cm.member_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Availability writes — atomic replace of the caller's own grid for one club
-- p_slots:   [{"day":3,"period":"after_school"}, ...]
-- p_windows: [{"day":3,"start":"15:30","end":"17:00"}, ...]
-- ---------------------------------------------------------------------------
create or replace function replace_availability(
  p_club uuid,
  p_slots jsonb default '[]'::jsonb,
  p_windows jsonb default '[]'::jsonb
)
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = clubsync, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'clubsync: authentication required' using errcode = '28000';
  end if;
  if not app_is_club_member(p_club) then
    raise exception 'clubsync: not a member of this club' using errcode = '42501';
  end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_typeof(p_windows) <> 'array' then
    raise exception 'clubsync: slots and windows must be JSON arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(p_slots) > 28 then
    raise exception 'clubsync: at most 28 slots' using errcode = '22023';
  end if;
  if jsonb_array_length(p_windows) > 21 then
    raise exception 'clubsync: at most 21 custom windows' using errcode = '22023';
  end if;

  delete from availability a where a.club_id = p_club and a.member_id = v_uid;
  delete from availability_windows w where w.club_id = p_club and w.member_id = v_uid;

  insert into availability (club_id, member_id, day_of_week, period)
  select p_club, v_uid, (s->>'day')::smallint, s->>'period'
    from jsonb_array_elements(p_slots) as s
  on conflict (club_id, member_id, day_of_week, period) do nothing;

  insert into availability_windows (club_id, member_id, day_of_week, starts_at, ends_at)
  select p_club, v_uid, (w->>'day')::smallint, (w->>'start')::time, (w->>'end')::time
    from jsonb_array_elements(p_windows) as w
  on conflict (club_id, member_id, day_of_week, starts_at, ends_at) do nothing;

  insert into availability_status (club_id, member_id, slot_count, window_count, updated_at)
  values (p_club, v_uid, 0, 0, now())
  on conflict (club_id, member_id) do update set updated_at = now();

  -- the row-level triggers have already written the true counts
  return (select s.updated_at from availability_status s
           where s.club_id = p_club and s.member_id = v_uid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Leader analytics — aggregate only. Never returns a member id.
-- ---------------------------------------------------------------------------
create or replace function club_overview(p_club uuid)
returns table (
  total_members integer,
  submitted_count integer,
  pending_count integer,
  upcoming_meetings integer,
  submission_rate numeric,
  last_submission_at timestamptz
)
language plpgsql
stable
security definer
set search_path = clubsync, public, pg_temp
as $$
declare
  v_total integer;
  v_submitted integer;
begin
  perform app_require_club_admin(p_club);

  select count(*)::integer into v_total
    from club_memberships cm where cm.club_id = p_club;

  select count(*)::integer into v_submitted
    from availability_status s
   where s.club_id = p_club and (s.slot_count > 0 or s.window_count > 0);

  return query
  select v_total,
         v_submitted,
         greatest(v_total - v_submitted, 0),
         (select count(*)::integer from meetings m
           where m.club_id = p_club and m.status = 'scheduled'
             and m.meeting_date >= current_date),
         case when v_total = 0 then 0::numeric
              else round((v_submitted::numeric / v_total) * 100, 1) end,
         (select max(s.updated_at) from availability_status s
           where s.club_id = p_club and (s.slot_count > 0 or s.window_count > 0));
end;
$$;

create or replace function club_availability_matrix(p_club uuid)
returns table (
  day_of_week smallint,
  period text,
  period_label text,
  member_count integer,
  pct numeric
)
language plpgsql
stable
security definer
set search_path = clubsync, public, pg_temp
as $$
declare
  v_total integer;
begin
  perform app_require_club_admin(p_club);

  select count(*)::integer into v_total
    from club_memberships cm where cm.club_id = p_club;

  return query
  select d.day::smallint,
         p.key,
         p.label,
         coalesce(a.n, 0)::integer,
         case when v_total = 0 then 0::numeric
              else round((coalesce(a.n, 0)::numeric / v_total) * 100, 1) end
    from generate_series(0, 6) as d(day)
    cross join availability_periods p
    left join (
      select av.day_of_week, av.period, count(*) as n
        from availability av
       where av.club_id = p_club
       group by av.day_of_week, av.period
    ) a on a.day_of_week = d.day and a.period = p.key
   order by d.day, p.sort_order;
end;
$$;

create or replace function club_day_totals(p_club uuid)
returns table (day_of_week smallint, member_count integer, pct numeric)
language plpgsql
stable
security definer
set search_path = clubsync, public, pg_temp
as $$
declare
  v_total integer;
begin
  perform app_require_club_admin(p_club);
  select count(*)::integer into v_total from club_memberships cm where cm.club_id = p_club;

  return query
  select d.day::smallint,
         coalesce(a.n, 0)::integer,
         case when v_total = 0 then 0::numeric
              else round((coalesce(a.n, 0)::numeric / v_total) * 100, 1) end
    from generate_series(0, 6) as d(day)
    left join (
      select av.day_of_week, count(distinct av.member_id) as n
        from availability av where av.club_id = p_club
       group by av.day_of_week
    ) a on a.day_of_week = d.day
   order by d.day;
end;
$$;

create or replace function club_period_totals(p_club uuid)
returns table (period text, period_label text, member_count integer, pct numeric)
language plpgsql
stable
security definer
set search_path = clubsync, public, pg_temp
as $$
declare
  v_total integer;
begin
  perform app_require_club_admin(p_club);
  select count(*)::integer into v_total from club_memberships cm where cm.club_id = p_club;

  return query
  select p.key, p.label,
         coalesce(a.n, 0)::integer,
         case when v_total = 0 then 0::numeric
              else round((coalesce(a.n, 0)::numeric / v_total) * 100, 1) end
    from availability_periods p
    left join (
      select av.period, count(distinct av.member_id) as n
        from availability av where av.club_id = p_club
       group by av.period
    ) a on a.period = p.key
   order by p.sort_order;
end;
$$;

create or replace function club_best_times(p_club uuid, p_limit integer default 5)
returns table (
  rank integer,
  day_of_week smallint,
  period text,
  period_label text,
  typical_start time,
  typical_end time,
  member_count integer,
  total_members integer,
  pct numeric
)
language plpgsql
stable
security definer
set search_path = clubsync, public, pg_temp
as $$
declare
  v_total integer;
begin
  perform app_require_club_admin(p_club);
  select count(*)::integer into v_total from club_memberships cm where cm.club_id = p_club;

  return query
  with counts as (
    select d.day::smallint as dow, p.key as pkey, p.label as plabel,
           p.sort_order, p.typical_start, p.typical_end,
           coalesce(a.n, 0)::integer as n
      from generate_series(0, 6) as d(day)
      cross join availability_periods p
      left join (
        select av.day_of_week, av.period, count(*) as n
          from availability av where av.club_id = p_club
         group by av.day_of_week, av.period
      ) a on a.day_of_week = d.day and a.period = p.key
  )
  select (row_number() over (order by c.n desc, c.sort_order, c.dow))::integer,
         c.dow, c.pkey, c.plabel, c.typical_start, c.typical_end,
         c.n, v_total,
         case when v_total = 0 then 0::numeric
              else round((c.n::numeric / v_total) * 100, 1) end
    from counts c
   where c.n > 0
   order by c.n desc, c.sort_order, c.dow
   limit greatest(coalesce(p_limit, 5), 1);
end;
$$;

-- Scheduler preview: how many members said they are free at this exact slot.
create or replace function club_slot_estimate(
  p_club uuid,
  p_date date,
  p_period text default null,
  p_starts time default null,
  p_ends time default null
)
returns table (
  day_of_week smallint,
  period_members integer,
  window_members integer,
  combined_members integer,
  total_members integer,
  pct numeric
)
language plpgsql
stable
security definer
set search_path = clubsync, public, pg_temp
as $$
declare
  v_total integer;
  v_day   smallint;
begin
  perform app_require_club_admin(p_club);
  if p_date is null then
    raise exception 'clubsync: a date is required' using errcode = '22023';
  end if;

  v_day := (extract(isodow from p_date)::integer - 1)::smallint;
  select count(*)::integer into v_total from club_memberships cm where cm.club_id = p_club;

  return query
  with by_period as (
    select av.member_id from availability av
     where av.club_id = p_club
       and av.day_of_week = v_day
       and p_period is not null
       and av.period = p_period
  ),
  by_window as (
    select w.member_id from availability_windows w
     where w.club_id = p_club
       and w.day_of_week = v_day
       and p_starts is not null and p_ends is not null
       and w.starts_at < p_ends
       and w.ends_at > p_starts
  ),
  combined as (
    select member_id from by_period
    union
    select member_id from by_window
  )
  select v_day,
         (select count(*)::integer from by_period),
         (select count(distinct member_id)::integer from by_window),
         (select count(*)::integer from combined),
         v_total,
         case when v_total = 0 then 0::numeric
              else round(((select count(*) from combined)::numeric / v_total) * 100, 1) end;
end;
$$;

-- Aggregated custom windows, for the heatmap's "precise hours" panel.
create or replace function club_window_histogram(p_club uuid)
returns table (day_of_week smallint, hour_slot smallint, member_count integer)
language plpgsql
stable
security definer
set search_path = clubsync, public, pg_temp
as $$
begin
  perform app_require_club_admin(p_club);

  return query
  select w.day_of_week,
         h.hour::smallint,
         count(distinct w.member_id)::integer
    from availability_windows w
    cross join generate_series(6, 22) as h(hour)
   where w.club_id = p_club
     and w.starts_at < make_time(h.hour, 59, 59)
     and w.ends_at   > make_time(h.hour, 0, 0)
   group by w.day_of_week, h.hour
   order by w.day_of_week, h.hour;
end;
$$;
