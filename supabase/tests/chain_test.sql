-- ============================================================================
-- ClubSync — officer proposes, students vote, officer books
-- ============================================================================
set client_min_messages = warning;
set search_path = clubsync, public, pg_temp;

drop table if exists t_results;
create table t_results (id serial primary key, label text, passed boolean, detail text);
grant all on t_results to authenticated, anon;
grant all on sequence t_results_id_seq to authenticated, anon;

create or replace function t_ok(l text, cond boolean, d text default null)
returns void language sql as $$ insert into t_results (label, passed, detail) values (l, cond, d); $$;

create or replace function t_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
  perform set_config('request.jwt.claims',
    case when uid is null or uid = '' then '' else json_build_object('sub', uid, 'role','authenticated')::text end, false);
end $$;

\set OFF_A '''11111111-1111-1111-1111-111111111111'''
\set OFF_B '''22222222-2222-2222-2222-222222222222'''
\set STU1  '''aaaaaaaa-0000-0000-0000-000000000001'''
\set STU2  '''aaaaaaaa-0000-0000-0000-000000000002'''
\set STU3  '''aaaaaaaa-0000-0000-0000-000000000003'''
\set CLUB_A '''cccccccc-0000-0000-0000-000000000001'''
\set CLUB_B '''dddddddd-0000-0000-0000-000000000001'''

insert into auth.users (id, email) values
  (:OFF_A,'cctia@officers.clubsync.invalid'), (:OFF_B,'deca@officers.clubsync.invalid'),
  (:STU1,'quietfox@members.clubsync.invalid'), (:STU2,'bluepanda@members.clubsync.invalid'),
  (:STU3,'swiftotter@members.clubsync.invalid');
insert into clubs (id, code, name) values (:CLUB_A,'CCTIA','CCTIA'), (:CLUB_B,'DECA','DECA');
insert into officers (id, club_id, handle) values (:OFF_A,:CLUB_A,'CCTIA'), (:OFF_B,:CLUB_B,'DECA');
insert into members (id, username) values (:STU1,'quietfox'), (:STU2,'bluepanda'), (:STU3,'swiftotter');
insert into club_memberships (club_id, member_id) values
  (:CLUB_A,:STU1), (:CLUB_A,:STU2), (:CLUB_A,:STU3), (:CLUB_B,:STU1);

-- ===========================================================================
-- OFFICER opens a vote
-- ===========================================================================
set role authenticated;
select t_as(:OFF_A);

do $$ begin
  begin perform officer_open_round(now() + interval '2 days',
    jsonb_build_array(jsonb_build_object('date', (current_date - 1)::text, 'slot','after_school')));
    perform t_ok('a past date is rejected', false, 'accepted');
  exception when others then perform t_ok('a past date is rejected', true, sqlstate); end;
end $$;

do $$ begin
  begin perform officer_open_round(now() + interval '2 days',
    jsonb_build_array(jsonb_build_object('date', (current_date + 3)::text, 'slot','lunch')));
    perform t_ok('only before/after school are accepted', false, 'lunch accepted');
  exception when others then perform t_ok('only before/after school are accepted', true, sqlstate); end;
end $$;

do $$ begin
  begin perform officer_open_round(now() - interval '1 hour',
    jsonb_build_array(jsonb_build_object('date', (current_date + 3)::text, 'slot','after_school')));
    perform t_ok('the deadline must be in the future', false, 'accepted');
  exception when others then perform t_ok('the deadline must be in the future', true, sqlstate); end;
end $$;

do $$ begin
  begin perform officer_open_round(now() + interval '2 days', '[]'::jsonb);
    perform t_ok('an empty vote is rejected', false, 'accepted');
  exception when others then perform t_ok('an empty vote is rejected', true, sqlstate); end;
end $$;

select officer_open_round(now() + interval '2 days', jsonb_build_array(
  jsonb_build_object('date', (current_date + 3)::text, 'slot','after_school'),
  jsonb_build_object('date', (current_date + 3)::text, 'slot','before_school'),
  jsonb_build_object('date', (current_date + 5)::text, 'slot','after_school')
));

select t_ok('officer opened a vote with three options', (select count(*) from officer_results()) = 3);
select t_ok('officer cannot read the roster',
  (select count(*) from members) = 0 and (select count(*) from club_memberships) = 0);

-- ===========================================================================
-- STUDENTS vote
-- ===========================================================================
select t_as(:STU1);
select t_ok('student sees the ballot', (select count(*) from member_ballots()) = 3);

select member_vote(o.id, true) from round_options o join rounds r on r.id = o.round_id
 where r.club_id = :CLUB_A and o.slot_date = current_date + 3 and o.slot = 'after_school';
select t_as(:STU2);
select member_vote(o.id, true) from round_options o join rounds r on r.id = o.round_id
 where r.club_id = :CLUB_A and o.slot_date = current_date + 3 and o.slot = 'after_school';
select t_as(:STU3);
select member_vote(o.id, true) from round_options o join rounds r on r.id = o.round_id
 where r.club_id = :CLUB_A and o.slot_date = current_date + 3 and o.slot = 'after_school';
select member_vote(o.id, true) from round_options o join rounds r on r.id = o.round_id
 where r.club_id = :CLUB_A and o.slot_date = current_date + 5 and o.slot = 'after_school';

select t_ok('a student sees only their own votes', (select count(*) from votes) = 2);

do $$
declare v_opt uuid; r boolean; n int;
begin
  select o.id into v_opt from round_options o where o.slot_date = current_date + 5 and o.slot = 'after_school';
  r := member_vote(v_opt, true);
  select count(*) into n from votes;
  perform t_ok('voting twice is idempotent', r = true and n = 2, 'votes='||n);
  r := member_vote(v_opt, false);
  select count(*) into n from votes;
  perform t_ok('a student can withdraw a vote', r = false and n = 1, 'votes='||n);
  perform member_vote(v_opt, true);
end $$;

-- ===========================================================================
-- OFFICER sees counts, never voters
-- ===========================================================================
select t_as(:OFF_A);
select t_ok('officer cannot read the votes table', (select count(*) from votes) = 0);
select t_ok('officer sees the correct tally',
  (select votes from officer_results() where slot_date = current_date + 3 and slot = 'after_school') = 3
  and (select votes from officer_results() where slot_date = current_date + 5 and slot = 'after_school') = 1
  and (select votes from officer_results() where slot_date = current_date + 3 and slot = 'before_school') = 0);
select t_ok('officer sees the club size', (select distinct total_members from officer_results()) = 3);

-- ===========================================================================
-- Booking
-- ===========================================================================
select officer_finalize(o.id, 'Room 214') from round_options o join rounds r on r.id = o.round_id
 where r.club_id = :CLUB_A and o.slot_date = current_date + 3 and o.slot = 'after_school';

select t_ok('booking creates the meeting and closes the vote',
  (select count(*) from meetings) = 1 and (select bool_and(closed) from officer_results()) = true);

select t_as(:STU1);
select t_ok('students see the booked meeting',
  (select count(*) from my_meetings(current_date, current_date + 30)) = 1);

-- ===========================================================================
-- Deadline locks voting
-- ===========================================================================
reset role;
insert into rounds (id, club_id, created_by, deadline, status)
values ('eeeeeeee-0000-0000-0000-000000000001', :CLUB_A, :OFF_A, now() + interval '1 day', 'open');
insert into round_options (id, round_id, slot_date, slot)
values ('ffffffff-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000001', current_date + 9, 'before_school');

set role authenticated;
select t_as(:STU1);
select t_ok('voting works before the deadline',
  (select member_vote('ffffffff-0000-0000-0000-000000000001', true)) = true);

reset role;
update rounds set deadline = now() - interval '1 minute' where id = 'eeeeeeee-0000-0000-0000-000000000001';
set role authenticated;
select t_as(:STU2);
do $$ begin
  begin perform member_vote('ffffffff-0000-0000-0000-000000000001', true);
    perform t_ok('voting after the deadline is rejected', false, 'accepted');
  exception when others then perform t_ok('voting after the deadline is rejected', true, sqlstate); end;
end $$;
select t_as(:STU1);
do $$ begin
  begin perform member_vote('ffffffff-0000-0000-0000-000000000001', false);
    perform t_ok('withdrawing after the deadline is rejected', false, 'accepted');
  exception when others then perform t_ok('withdrawing after the deadline is rejected', true, sqlstate); end;
end $$;

-- ===========================================================================
-- Isolation
-- ===========================================================================
select t_as(:STU2);
select t_ok('a student only sees their own clubs'' ballots',
  (select count(distinct club_code) from member_ballots()) <= 1);
do $$ begin
  begin perform officer_results();
    perform t_ok('a student cannot call officer_results', false, 'allowed');
  exception when others then perform t_ok('a student cannot call officer_results', true, sqlstate); end;
end $$;
do $$ begin
  begin perform officer_open_round(now() + interval '1 day',
    jsonb_build_array(jsonb_build_object('date', (current_date + 2)::text, 'slot','after_school')));
    perform t_ok('a student cannot open a vote', false, 'allowed');
  exception when others then perform t_ok('a student cannot open a vote', true, sqlstate); end;
end $$;

select t_as(:OFF_B);
select t_ok('another club''s officer sees none of our votes', (select count(*) from officer_results()) = 0);
select t_ok('another club''s officer sees none of our meetings',
  (select count(*) from my_meetings(current_date, current_date + 30)) = 0);

-- joining
select t_as(:STU2);
do $$ begin
  begin perform join_club('NOPE');
    perform t_ok('a wrong club code is rejected', false, 'accepted');
  exception when others then perform t_ok('a wrong club code is rejected', true, sqlstate); end;
end $$;
do $$
declare n int;
begin
  perform join_club('DECA');
  select count(*) into n from club_memberships;
  perform t_ok('a student can join another club with its code', n = 2, 'memberships='||n);
end $$;

reset role;
set role anon;
select t_as(null);
do $$ declare n int; begin
  begin select count(*) into n from clubs;
    perform t_ok('anon cannot read clubs', false, 'read succeeded');
  exception when others then perform t_ok('anon cannot read clubs', true, sqlstate); end;
end $$;
do $$ declare n int; begin
  begin select count(*) into n from meetings;
    perform t_ok('anon cannot read meetings', false, 'read succeeded');
  exception when others then perform t_ok('anon cannot read meetings', true, sqlstate); end;
end $$;

reset role;
\pset border 2
select id, case when passed then 'PASS' else 'FAIL' end as result, label, detail from t_results order by id;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed, count(*) as total from t_results;
do $$ declare n int; begin
  select count(*) into n from t_results where not passed;
  if n > 0 then raise exception 'ClubSync suite: % assertion(s) failed', n; end if;
end $$;
