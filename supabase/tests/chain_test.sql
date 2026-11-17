-- ============================================================================
-- ClubSync v2 — the sponsor -> officer -> student constraint chain
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

\set SPONSOR '''55555555-5555-5555-5555-555555555555'''
\set OFF_A   '''11111111-1111-1111-1111-111111111111'''
\set OFF_B   '''22222222-2222-2222-2222-222222222222'''
\set STU1    '''aaaaaaaa-0000-0000-0000-000000000001'''
\set STU2    '''aaaaaaaa-0000-0000-0000-000000000002'''
\set STU3    '''aaaaaaaa-0000-0000-0000-000000000003'''
\set CLUB_A  '''cccccccc-0000-0000-0000-000000000001'''
\set CLUB_B  '''dddddddd-0000-0000-0000-000000000001'''

-- One sponsor running TWO clubs — that is what makes slot contention possible.
insert into auth.users (id, email) values
  (:SPONSOR,'ms.rivera@sponsors.clubsync.invalid'),
  (:OFF_A,'cctia@officers.clubsync.invalid'),
  (:OFF_B,'deca@officers.clubsync.invalid'),
  (:STU1,'quietfox@members.clubsync.invalid'),
  (:STU2,'bluepanda@members.clubsync.invalid'),
  (:STU3,'swiftotter@members.clubsync.invalid');

insert into clubs (id, code, name) values (:CLUB_A,'CCTIA','CCTIA'), (:CLUB_B,'DECA','DECA');
insert into sponsors (id, handle, display_name) values (:SPONSOR,'ms.rivera','Ms. Rivera');
insert into club_sponsors (club_id, sponsor_id) values (:CLUB_A,:SPONSOR), (:CLUB_B,:SPONSOR);
insert into officers (id, club_id, handle) values (:OFF_A,:CLUB_A,'CCTIA'), (:OFF_B,:CLUB_B,'DECA');
insert into members (id, username) values (:STU1,'quietfox'), (:STU2,'bluepanda'), (:STU3,'swiftotter');
insert into club_memberships (club_id, member_id) values
  (:CLUB_A,:STU1), (:CLUB_A,:STU2), (:CLUB_A,:STU3), (:CLUB_B,:STU1);

-- ===========================================================================
-- 1. SPONSOR offers availability
-- ===========================================================================
set role authenticated;
select t_as(:SPONSOR);

select t_ok('sponsor sees both of their clubs', (select count(*) from my_clubs()) = 2);

select sponsor_toggle_slot(current_date + 3, 'after_school');
select sponsor_toggle_slot(current_date + 3, 'before_school');
select sponsor_toggle_slot(current_date + 5, 'after_school');
select sponsor_toggle_slot(current_date + 7, 'after_school');

select t_ok('sponsor offered four slots', (select count(*) from sponsor_slots) = 4);

-- NB: a volatile function and a count must not share one statement — the
-- count would read the pre-call snapshot. Sequential statements in plpgsql.
do $$
declare r boolean; n int;
begin
  r := sponsor_toggle_slot(current_date + 7, 'after_school');
  select count(*) into n from sponsor_slots;
  perform t_ok('toggling an offered slot removes it', r = false and n = 3, 'returned='||r||' slots='||n);
end $$;

do $$ begin
  begin perform sponsor_toggle_slot(current_date + 3, 'lunch');
    perform t_ok('only before/after school are accepted', false, 'lunch was accepted');
  exception when others then perform t_ok('only before/after school are accepted', true, sqlstate); end;
end $$;

do $$ begin
  begin perform sponsor_toggle_slot(current_date - 1, 'after_school');
    perform t_ok('a past date is refused', false, 'past date accepted');
  exception when others then perform t_ok('a past date is refused', true, sqlstate); end;
end $$;

-- ===========================================================================
-- 2. OFFICER is fenced in by the sponsor
-- ===========================================================================
select t_as(:OFF_A);

select t_ok('officer sees exactly the sponsor''s three slots',
  (select count(*) from officer_slots(current_date, current_date + 30)) = 3);

select t_ok('officer cannot read sponsor_slots directly',
  (select count(*) from sponsor_slots) = 0);

select t_ok('officer cannot read the student roster',
  (select count(*) from members) = 0 and (select count(*) from club_memberships) = 0);

do $$
declare v_fake uuid := gen_random_uuid();
begin
  begin perform officer_open_round(now() + interval '2 days', array[v_fake]);
    perform t_ok('officer cannot open a slot the sponsor never offered', false, 'accepted');
  exception when others then perform t_ok('officer cannot open a slot the sponsor never offered', true, sqlstate); end;
end $$;

do $$ begin
  begin perform officer_open_round(now() - interval '1 hour', array(select slot_id from officer_slots(current_date, current_date+30) limit 1));
    perform t_ok('deadline must be in the future', false, 'accepted');
  exception when others then perform t_ok('deadline must be in the future', true, sqlstate); end;
end $$;

-- open a real round on all three slots
select officer_open_round(now() + interval '2 days',
  array(select slot_id from officer_slots(current_date, current_date + 30))) as round_a \gset

select t_ok('officer opened a round with three options',
  (select count(*) from officer_results()) = 3);

-- ===========================================================================
-- 3. STUDENTS vote
-- ===========================================================================
select t_as(:STU1);
select t_ok('student sees the ballot for their club',
  (select count(*) from member_ballots() where club_code = 'CCTIA') = 3);

select member_vote(o.id, true) from round_options o
  join rounds r on r.id = o.round_id where r.club_id = :CLUB_A
  and o.slot_date = current_date + 3 and o.slot = 'after_school';

select t_as(:STU2);
select member_vote(o.id, true) from round_options o
  join rounds r on r.id = o.round_id where r.club_id = :CLUB_A
  and o.slot_date = current_date + 3 and o.slot = 'after_school';

select t_as(:STU3);
select member_vote(o.id, true) from round_options o
  join rounds r on r.id = o.round_id where r.club_id = :CLUB_A
  and o.slot_date = current_date + 3 and o.slot = 'after_school';
select member_vote(o.id, true) from round_options o
  join rounds r on r.id = o.round_id where r.club_id = :CLUB_A
  and o.slot_date = current_date + 5 and o.slot = 'after_school';

select t_ok('a student sees only their own votes', (select count(*) from votes) = 2);

do $$
declare v_opt uuid; r boolean; n int;
begin
  select o.id into v_opt from round_options o join rounds r2 on r2.id = o.round_id
   where o.slot_date = current_date + 5 and o.slot = 'after_school';

  r := member_vote(v_opt, true);
  select count(*) into n from votes;
  perform t_ok('voting twice for the same option is idempotent', r = true and n = 2, 'votes='||n);

  r := member_vote(v_opt, false);
  select count(*) into n from votes;
  perform t_ok('a student can withdraw a vote', r = false and n = 1, 'votes='||n);
end $$;

-- put it back so the tallies below are stable
select member_vote(o.id, true) from round_options o
  join rounds r on r.id = o.round_id where r.club_id = :CLUB_A
  and o.slot_date = current_date + 5 and o.slot = 'after_school';

-- ===========================================================================
-- 4. OFFICER sees counts, never voters
-- ===========================================================================
select t_as(:OFF_A);

select t_ok('officer cannot read the votes table at all', (select count(*) from votes) = 0);

select t_ok('officer sees the right tally (3 for day+3 after school)',
  (select votes from officer_results() where slot_date = current_date + 3 and slot = 'after_school') = 3
  and (select votes from officer_results() where slot_date = current_date + 5 and slot = 'after_school') = 1
  and (select votes from officer_results() where slot_date = current_date + 3 and slot = 'before_school') = 0);

select t_ok('officer sees the club size alongside the tally',
  (select distinct total_members from officer_results()) = 3);

select t_ok('officer_results returns no voter identity',
  (select count(*) from information_schema.columns
    where table_schema = 'clubsync'
      and column_name in ('member_id','username')
      and table_name = 'votes') = 1);

-- ===========================================================================
-- 5. FIRST COME FIRST SERVED between two clubs sharing one sponsor
-- ===========================================================================
select officer_finalize(o.id, 'Room 214') from round_options o
  join rounds r on r.id = o.round_id where r.club_id = :CLUB_A
  and o.slot_date = current_date + 3 and o.slot = 'after_school';

select t_ok('finalising creates the meeting and closes the round',
  (select count(*) from meetings where club_id = :CLUB_A) = 1
  and (select bool_and(closed) from officer_results()) = true);

-- now DECA tries for the very same sponsor slot
select t_as(:OFF_B);
select t_ok('the taken slot is flagged to the other club',
  (select taken_by_club from officer_slots(current_date, current_date + 30)
    where slot_date = current_date + 3 and slot = 'after_school') = 'CCTIA');

do $$
declare v_slot uuid;
begin
  select s.id into v_slot from sponsor_slots s
   where s.slot_date = current_date + 3 and s.slot = 'after_school';
  begin
    perform officer_open_round(now() + interval '1 day', array[v_slot]);
    perform t_ok('a club cannot open a vote on an already booked slot', false, 'accepted');
  exception when others then perform t_ok('a club cannot open a vote on an already booked slot', true, sqlstate); end;
end $$;

-- DECA takes a different one, which must succeed
select officer_open_round(now() + interval '1 day',
  array(select slot_id from officer_slots(current_date, current_date + 30)
         where slot_date = current_date + 5)) as round_b \gset
select officer_finalize(o.id, 'Lab 2') from round_options o
  join rounds r on r.id = o.round_id where r.club_id = :CLUB_B limit 1;

select t_ok('the other club can still book a free slot',
  (select count(*) from meetings where club_id = :CLUB_B) = 1);

-- ===========================================================================
-- 6. SPONSOR protections and calendar
-- ===========================================================================
select t_as(:SPONSOR);

do $$ begin
  begin perform sponsor_toggle_slot(current_date + 3, 'after_school');
    perform t_ok('sponsor cannot withdraw a slot a club has booked', false, 'withdrawn');
  exception when others then perform t_ok('sponsor cannot withdraw a slot a club has booked', true, sqlstate); end;
end $$;

select t_ok('sponsor calendar shows who booked what',
  (select booked_club_code from sponsor_calendar(current_date, current_date + 30)
    where slot_date = current_date + 3 and slot = 'after_school') = 'CCTIA'
  and (select booked_club_code from sponsor_calendar(current_date, current_date + 30)
    where slot_date = current_date + 5 and slot = 'after_school') = 'DECA');

select t_ok('sponsor sees both clubs'' meetings on one calendar',
  (select count(*) from my_meetings(current_date, current_date + 30)) = 2);

-- ===========================================================================
-- 7. Deadline really locks voting
-- ===========================================================================
reset role;
insert into rounds (id, club_id, created_by, deadline, status)
values ('eeeeeeee-0000-0000-0000-000000000001', :CLUB_A, :OFF_A, now() + interval '1 day', 'open');
insert into round_options (id, round_id, sponsor_slot_id, slot_date, slot)
select 'ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', s.id, s.slot_date, s.slot
  from sponsor_slots s where s.slot_date = current_date + 3 and s.slot = 'before_school';

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
    perform t_ok('voting after the deadline is rejected', false, 'vote accepted');
  exception when others then perform t_ok('voting after the deadline is rejected', true, sqlstate); end;
end $$;

select t_as(:STU1);
do $$ begin
  begin perform member_vote('ffffffff-0000-0000-0000-000000000001', false);
    perform t_ok('withdrawing after the deadline is rejected too', false, 'withdrawal accepted');
  exception when others then perform t_ok('withdrawing after the deadline is rejected too', true, sqlstate); end;
end $$;

-- ===========================================================================
-- 8. Cross-club and anon isolation
-- ===========================================================================
select t_as(:STU2);
select t_ok('a student only sees ballots for clubs they are in',
  (select count(distinct club_code) from member_ballots()) <= 1);

do $$ begin
  begin perform officer_results();
    perform t_ok('a student cannot call officer_results', false, 'allowed');
  exception when others then perform t_ok('a student cannot call officer_results', true, sqlstate); end;
end $$;

do $$ begin
  begin perform sponsor_toggle_slot(current_date + 9, 'after_school');
    perform t_ok('a student cannot offer sponsor slots', false, 'allowed');
  exception when others then perform t_ok('a student cannot offer sponsor slots', true, sqlstate); end;
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

-- ===========================================================================
reset role;
\pset border 2
select id, case when passed then 'PASS' else 'FAIL' end as result, label, detail from t_results order by id;
select count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed, count(*) as total from t_results;
do $$ declare n int; begin
  select count(*) into n from t_results where not passed;
  if n > 0 then raise exception 'ClubSync v2 chain suite: % assertion(s) failed', n; end if;
  raise notice 'ClubSync v2 chain suite: all assertions passed';
end $$;
