-- ============================================================================
-- ClubSync — Row Level Security / privacy test suite
-- ============================================================================
-- Run against a database that has local-shim.sql + all migrations applied:
--   psql -d clubsync_test -f supabase/tests/privacy_rls_test.sql
-- Prints a PASS/FAIL table and raises at the end if anything failed.
-- ============================================================================
set client_min_messages = warning;

drop table if exists t_results;
create table t_results (id serial primary key, label text, passed boolean, detail text);
grant all on t_results to authenticated, anon;
grant all on sequence t_results_id_seq to authenticated, anon;

create or replace function t_ok(l text, cond boolean, d text default null)
returns void language sql as $$
  insert into t_results (label, passed, detail) values (l, cond, d);
$$;

create or replace function t_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures, created as the table owner (bypasses RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'CCTIA@admins.clubsync.invalid'),
  ('22222222-2222-2222-2222-222222222222', 'ROBOTICS@admins.clubsync.invalid'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'quietfox@members.clubsync.invalid'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bluepanda@members.clubsync.invalid'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'swiftotter@members.clubsync.invalid'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'calmheron@members.clubsync.invalid'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'brightkoi@members.clubsync.invalid');

insert into clubs (id, code, name, school) values
  ('cccccccc-0000-0000-0000-000000000001', 'CCTIA', 'CCTIA', 'Demo High'),
  ('dddddddd-0000-0000-0000-000000000001', 'ROBOTICS', 'Robotics Team', 'Demo High');

insert into club_admins (club_id, user_id, admin_handle) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'CCTIA'),
  ('dddddddd-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'ROBOTICS');

insert into members (id, username) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'quietfox'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bluepanda'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'swiftotter'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'calmheron'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'brightkoi');

insert into club_memberships (club_id, member_id, member_number) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 0),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 0),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 0),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 0),
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004', 0),
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 0);

-- Availability in CCTIA: Thursday after school is the clear winner (4/4),
-- Tuesday after school next (2/4), Monday lunch (1/4).
insert into availability (club_id, member_id, day_of_week, period) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 3, 'after_school'),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 3, 'after_school'),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 3, 'after_school'),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 3, 'after_school'),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 'after_school'),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 1, 'after_school'),
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 0, 'lunch');

insert into availability_windows (club_id, member_id, day_of_week, starts_at, ends_at) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 3, '15:30', '17:30');

-- ===========================================================================
-- Group 1 — member isolation
-- ===========================================================================
set role authenticated;
select t_as('aaaaaaaa-0000-0000-0000-000000000001');

select t_ok('member sees exactly their own members row',
  (select count(*) from members) = 1
  and (select username from members) = 'quietfox');

select t_ok('member cannot read another member''s availability',
  (select count(*) from availability where member_id <> 'aaaaaaaa-0000-0000-0000-000000000001') = 0);

select t_ok('member sees only their own availability rows',
  (select count(*) from availability) = 3);

select t_ok('member cannot enumerate club_admins',
  (select count(*) from club_admins) = 0);

select t_ok('member sees only their own memberships',
  (select count(*) from club_memberships) = 1);

select t_ok('member can read the club they joined',
  (select count(*) from clubs) = 1
  and (select code from clubs) = 'CCTIA');

do $$
begin
  begin
    insert into availability (club_id, member_id, day_of_week, period)
    values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 5, 'evening');
    perform t_ok('member cannot write availability for someone else', false, 'insert succeeded');
  exception when others then
    perform t_ok('member cannot write availability for someone else', true, sqlstate);
  end;
end $$;

do $$
begin
  begin
    perform replace_availability('dddddddd-0000-0000-0000-000000000001', '[]'::jsonb, '[]'::jsonb);
    perform t_ok('member cannot submit availability to a club they are not in', false, 'no exception');
  exception when others then
    perform t_ok('member cannot submit availability to a club they are not in', true, sqlstate);
  end;
end $$;

do $$
begin
  begin
    update members set username = 'someoneelse' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    perform t_ok('username is immutable', false, 'update succeeded');
  exception when others then
    perform t_ok('username is immutable', true, sqlstate);
  end;
end $$;

do $$
begin
  begin
    perform club_overview('cccccccc-0000-0000-0000-000000000001');
    perform t_ok('member cannot call leader analytics', false, 'no exception');
  exception when others then
    perform t_ok('member cannot call leader analytics', true, sqlstate);
  end;
end $$;

-- ===========================================================================
-- Group 2 — leaders are blind to member identity
-- ===========================================================================
select t_as('11111111-1111-1111-1111-111111111111');

select t_ok('leader cannot read the members table at all',
  (select count(*) from members) = 0);

select t_ok('leader cannot read club_memberships rows',
  (select count(*) from club_memberships) = 0);

select t_ok('leader cannot read raw availability rows',
  (select count(*) from availability) = 0);

select t_ok('leader cannot read raw availability_windows rows',
  (select count(*) from availability_windows) = 0);

select t_ok('leader cannot read availability_status rows',
  (select count(*) from availability_status) = 0);

select t_ok('leader cannot read other members'' notifications',
  (select count(*) from notifications) = 0);

select t_ok('leader reads only their own club',
  (select count(*) from clubs) = 1
  and (select code from clubs) = 'CCTIA');

select t_ok('leader reads only their own admin record',
  (select count(*) from club_admins) = 1);

-- ===========================================================================
-- Group 3 — aggregate analytics return correct, identity-free numbers
-- ===========================================================================
select t_ok('club_overview counts 4 members, 4 submitted',
  (select total_members from club_overview('cccccccc-0000-0000-0000-000000000001')) = 4
  and (select submitted_count from club_overview('cccccccc-0000-0000-0000-000000000001')) = 4
  and (select pending_count from club_overview('cccccccc-0000-0000-0000-000000000001')) = 0);

select t_ok('club_availability_matrix returns a full 7x4 grid',
  (select count(*) from club_availability_matrix('cccccccc-0000-0000-0000-000000000001')) = 28);

select t_ok('matrix: Thursday after school = 4 members (100%)',
  (select member_count from club_availability_matrix('cccccccc-0000-0000-0000-000000000001')
     where day_of_week = 3 and period = 'after_school') = 4
  and (select pct from club_availability_matrix('cccccccc-0000-0000-0000-000000000001')
     where day_of_week = 3 and period = 'after_school') = 100.0);

select t_ok('matrix: Tuesday after school = 2 members (50%)',
  (select member_count from club_availability_matrix('cccccccc-0000-0000-0000-000000000001')
     where day_of_week = 1 and period = 'after_school') = 2
  and (select pct from club_availability_matrix('cccccccc-0000-0000-0000-000000000001')
     where day_of_week = 1 and period = 'after_school') = 50.0);

select t_ok('best_times ranks Thursday after school first',
  (select day_of_week from club_best_times('cccccccc-0000-0000-0000-000000000001', 5) where rank = 1) = 3
  and (select period from club_best_times('cccccccc-0000-0000-0000-000000000001', 5) where rank = 1) = 'after_school'
  and (select member_count from club_best_times('cccccccc-0000-0000-0000-000000000001', 5) where rank = 1) = 4);

select t_ok('best_times second choice is Tuesday after school',
  (select day_of_week from club_best_times('cccccccc-0000-0000-0000-000000000001', 5) where rank = 2) = 1);

select t_ok('best_times omits slots with zero availability',
  (select count(*) from club_best_times('cccccccc-0000-0000-0000-000000000001', 50)) = 3);

select t_ok('day_totals counts distinct members per day',
  (select member_count from club_day_totals('cccccccc-0000-0000-0000-000000000001') where day_of_week = 3) = 4
  and (select member_count from club_day_totals('cccccccc-0000-0000-0000-000000000001') where day_of_week = 2) = 0);

select t_ok('period_totals counts distinct members per period',
  (select member_count from club_period_totals('cccccccc-0000-0000-0000-000000000001') where period = 'after_school') = 4
  and (select member_count from club_period_totals('cccccccc-0000-0000-0000-000000000001') where period = 'lunch') = 1);

-- 2026-11-19 is a Thursday -> day_of_week 3
select t_ok('slot_estimate maps a date to the right weekday and count',
  (select day_of_week from club_slot_estimate('cccccccc-0000-0000-0000-000000000001', '2026-11-19', 'after_school', '15:15', '17:00')) = 3
  and (select period_members from club_slot_estimate('cccccccc-0000-0000-0000-000000000001', '2026-11-19', 'after_school', '15:15', '17:00')) = 4
  and (select combined_members from club_slot_estimate('cccccccc-0000-0000-0000-000000000001', '2026-11-19', 'after_school', '15:15', '17:00')) = 4
  and (select pct from club_slot_estimate('cccccccc-0000-0000-0000-000000000001', '2026-11-19', 'after_school', '15:15', '17:00')) = 100.0);

select t_ok('slot_estimate picks up overlapping custom windows',
  (select window_members from club_slot_estimate('cccccccc-0000-0000-0000-000000000001', '2026-11-19', null, '17:00', '17:30')) = 1
  and (select combined_members from club_slot_estimate('cccccccc-0000-0000-0000-000000000001', '2026-11-19', null, '17:00', '17:30')) = 1);

select t_ok('slot_estimate is empty for a quiet weekday',
  (select combined_members from club_slot_estimate('cccccccc-0000-0000-0000-000000000001', '2026-11-18', 'after_school', '15:15', '17:00')) = 0);

-- A leader of a different club must not be able to read these aggregates.
select t_as('22222222-2222-2222-2222-222222222222');
do $$
begin
  begin
    perform club_overview('cccccccc-0000-0000-0000-000000000001');
    perform t_ok('another club''s leader cannot read our analytics', false, 'no exception');
  exception when others then
    perform t_ok('another club''s leader cannot read our analytics', true, sqlstate);
  end;
end $$;

do $$
begin
  begin
    perform club_best_times('cccccccc-0000-0000-0000-000000000001', 5);
    perform t_ok('another club''s leader cannot read our best times', false, 'no exception');
  exception when others then
    perform t_ok('another club''s leader cannot read our best times', true, sqlstate);
  end;
end $$;

-- ===========================================================================
-- Group 4 — meetings and notification fan-out
-- ===========================================================================
select t_as('11111111-1111-1111-1111-111111111111');

insert into meetings (id, club_id, title, description, location, meeting_date, starts_at, ends_at, period_hint, status, estimated_available, estimated_total, created_by)
values ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
        'Competition prep', 'Bring your laptop.', 'Room 214',
        '2026-11-19', '15:15', '17:00', 'after_school', 'scheduled', 4, 4,
        '11111111-1111-1111-1111-111111111111');

select t_ok('leader can publish a meeting for their own club',
  (select count(*) from meetings where club_id = 'cccccccc-0000-0000-0000-000000000001') = 1);

do $$
begin
  begin
    insert into meetings (club_id, title, meeting_date, starts_at, ends_at)
    values ('dddddddd-0000-0000-0000-000000000001', 'Hostile takeover', '2026-11-20', '15:00', '16:00');
    perform t_ok('leader cannot publish into another club', false, 'insert succeeded');
  exception when others then
    perform t_ok('leader cannot publish into another club', true, sqlstate);
  end;
end $$;

reset role;
select t_ok('publishing fanned out one notification per club member',
  (select count(*) from notifications
    where meeting_id = 'eeeeeeee-0000-0000-0000-000000000001'
      and kind = 'meeting_scheduled') = 4);

set role authenticated;
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select t_ok('member can see the new meeting on their calendar',
  (select count(*) from meetings) = 1);
select t_ok('member received the scheduled notification',
  (select count(*) from notifications where kind = 'meeting_scheduled') = 1);

select t_as('aaaaaaaa-0000-0000-0000-000000000004');
select t_ok('a member of another club sees neither the meeting nor the notice',
  (select count(*) from meetings) = 0
  and (select count(*) from notifications) = 0);

-- reschedule, then cancel
select t_as('11111111-1111-1111-1111-111111111111');
update meetings set starts_at = '15:45', ends_at = '17:30'
 where id = 'eeeeeeee-0000-0000-0000-000000000001';
update meetings set status = 'cancelled', cancellation_reason = 'Snow day'
 where id = 'eeeeeeee-0000-0000-0000-000000000001';

reset role;
select t_ok('rescheduling notified every member',
  (select count(*) from notifications where kind = 'meeting_updated') = 4);
select t_ok('cancelling notified every member',
  (select count(*) from notifications where kind = 'meeting_cancelled') = 4);

-- ===========================================================================
-- Group 5 — joining, member numbers, availability status triggers
-- ===========================================================================
set role authenticated;
select t_as('aaaaaaaa-0000-0000-0000-000000000004');

select t_ok('lookup by a code you do not hold returns the club summary',
  (select count(*) from lookup_club_by_code('cctia')) = 1
  and (select already_member from lookup_club_by_code('CCTIA')) = false
  and (select member_count from lookup_club_by_code('CCTIA')) = 4);

select t_ok('lookup with a wrong code returns nothing',
  (select count(*) from lookup_club_by_code('NOPE123')) = 0);

do $$
begin
  begin
    perform join_club_with_code('NOPE123');
    perform t_ok('joining with a wrong code is rejected', false, 'no exception');
  exception when others then
    perform t_ok('joining with a wrong code is rejected', true, sqlstate);
  end;
end $$;

select t_ok('joining assigns the next anonymous member number',
  (select member_number from join_club_with_code('CCTIA')) = 5
  and (select was_new from join_club_with_code('CCTIA')) = false);

select t_ok('joining is idempotent — no duplicate membership',
  (select count(*) from club_memberships where club_id = 'cccccccc-0000-0000-0000-000000000001') = 1);

select t_ok('member can belong to several clubs with one account',
  (select count(*) from club_memberships) = 2);

select replace_availability(
  'cccccccc-0000-0000-0000-000000000001',
  '[{"day":3,"period":"after_school"},{"day":4,"period":"evening"}]'::jsonb,
  '[{"day":4,"start":"18:00","end":"19:30"}]'::jsonb);

select t_ok('replace_availability wrote the grid',
  (select count(*) from availability where club_id = 'cccccccc-0000-0000-0000-000000000001') = 2
  and (select count(*) from availability_windows where club_id = 'cccccccc-0000-0000-0000-000000000001') = 1);

select t_ok('availability_status tracks counts and a timestamp',
  (select slot_count from availability_status where club_id = 'cccccccc-0000-0000-0000-000000000001') = 2
  and (select window_count from availability_status where club_id = 'cccccccc-0000-0000-0000-000000000001') = 1
  and (select updated_at is not null from availability_status where club_id = 'cccccccc-0000-0000-0000-000000000001'));

select replace_availability('cccccccc-0000-0000-0000-000000000001', '[]'::jsonb, '[]'::jsonb);
select t_ok('clearing availability zeroes the counts but keeps the status row',
  (select count(*) from availability where club_id = 'cccccccc-0000-0000-0000-000000000001') = 0
  and (select slot_count from availability_status where club_id = 'cccccccc-0000-0000-0000-000000000001') = 0);

select t_as('11111111-1111-1111-1111-111111111111');
select t_ok('overview now shows 5 members with 4 submitted and 1 pending',
  (select total_members from club_overview('cccccccc-0000-0000-0000-000000000001')) = 5
  and (select submitted_count from club_overview('cccccccc-0000-0000-0000-000000000001')) = 4
  and (select pending_count from club_overview('cccccccc-0000-0000-0000-000000000001')) = 1
  and (select submission_rate from club_overview('cccccccc-0000-0000-0000-000000000001')) = 80.0);

-- ===========================================================================
-- Group 6 — anonymous (not signed in) role is locked out
-- ===========================================================================
reset role;
set role anon;
select t_as(null);

do $$
declare n integer;
begin
  begin
    select count(*) into n from clubs;
    perform t_ok('anon cannot read clubs', false, 'read succeeded: ' || n);
  exception when others then
    perform t_ok('anon cannot read clubs', true, sqlstate);
  end;
end $$;

do $$
declare n integer;
begin
  begin
    select count(*) into n from members;
    perform t_ok('anon cannot read members', false, 'read succeeded: ' || n);
  exception when others then
    perform t_ok('anon cannot read members', true, sqlstate);
  end;
end $$;

do $$
begin
  begin
    perform lookup_club_by_code('CCTIA');
    perform t_ok('anon cannot look up clubs by code', false, 'no exception');
  exception when others then
    perform t_ok('anon cannot look up clubs by code', true, sqlstate);
  end;
end $$;

-- ===========================================================================
-- Group 7 — schema validation
-- ===========================================================================
reset role;

do $$
begin
  begin
    insert into clubs (code, name) values ('lowercase', 'Bad');
    perform t_ok('club codes must be uppercase and well formed', false, 'insert succeeded');
  exception when others then
    perform t_ok('club codes must be uppercase and well formed', true, sqlstate);
  end;
end $$;

do $$
begin
  begin
    insert into members (id, username) values ('aaaaaaaa-0000-0000-0000-000000000009', 'Bad Name!');
    perform t_ok('usernames are restricted to lowercase slug characters', false, 'insert succeeded');
  exception when others then
    perform t_ok('usernames are restricted to lowercase slug characters', true, sqlstate);
  end;
end $$;

do $$
begin
  begin
    insert into meetings (club_id, title, meeting_date, starts_at, ends_at)
    values ('cccccccc-0000-0000-0000-000000000001', 'Backwards', '2026-12-01', '17:00', '15:00');
    perform t_ok('a meeting cannot end before it starts', false, 'insert succeeded');
  exception when others then
    perform t_ok('a meeting cannot end before it starts', true, sqlstate);
  end;
end $$;

do $$
begin
  begin
    insert into availability (club_id, member_id, day_of_week, period)
    values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 9, 'lunch');
    perform t_ok('day_of_week is constrained to 0..6', false, 'insert succeeded');
  exception when others then
    perform t_ok('day_of_week is constrained to 0..6', true, sqlstate);
  end;
end $$;

do $$
begin
  begin
    insert into availability (club_id, member_id, day_of_week, period)
    values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 2, 'lunch');
    perform t_ok('availability requires an existing membership', false, 'insert succeeded');
  exception when others then
    perform t_ok('availability requires an existing membership', true, sqlstate);
  end;
end $$;

do $$
begin
  begin
    update club_admins set club_id = 'dddddddd-0000-0000-0000-000000000001'
     where admin_handle = 'CCTIA';
    perform t_ok('an administrator cannot be repointed at another club', false, 'update succeeded');
  exception when others then
    perform t_ok('an administrator cannot be repointed at another club', true, sqlstate);
  end;
end $$;

select t_ok('members table has no column that could hold PII',
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'members'
      and column_name ~* '(email|phone|first_name|last_name|full_name|real_name|student_id)') = 0);

-- ===========================================================================
-- Report
-- ===========================================================================
\pset border 2
select id, case when passed then 'PASS' else 'FAIL' end as result, label, detail
  from t_results order by id;

select count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed,
       count(*) as total
  from t_results;

do $$
declare n integer;
begin
  select count(*) into n from t_results where not passed;
  if n > 0 then
    raise exception 'ClubSync privacy suite: % assertion(s) failed', n;
  end if;
  raise notice 'ClubSync privacy suite: all assertions passed';
end $$;
