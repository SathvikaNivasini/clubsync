-- ============================================================================
-- ClubSync — Row Level Security
-- ============================================================================
-- The privacy guarantee in one table:
--
--   table                  member (own rows)   club leader
--   ---------------------  ------------------  ---------------------------
--   members                full                NONE
--   club_memberships       full                NONE  (counts via RPC only)
--   availability           full                NONE  (counts via RPC only)
--   availability_windows   full                NONE  (counts via RPC only)
--   availability_status    read                NONE  (counts via RPC only)
--   clubs                  read (joined only)  read + update (own club)
--   club_admins            NONE                read + limited update (self)
--   meetings               read (joined only)  full (own club)
--   notifications          full                NONE
--   push_subscriptions     full                full (own rows only)
-- ============================================================================

alter table availability_periods  enable row level security;
alter table clubs                 enable row level security;
alter table club_admins           enable row level security;
alter table members               enable row level security;
alter table club_memberships      enable row level security;
alter table availability          enable row level security;
alter table availability_windows  enable row level security;
alter table availability_status   enable row level security;
alter table meetings              enable row level security;
alter table notifications         enable row level security;
alter table push_subscriptions    enable row level security;

-- --------------------------------------------------------------------------
-- availability_periods — static reference data, readable by anyone signed in
-- --------------------------------------------------------------------------
drop policy if exists periods_read on availability_periods;
create policy periods_read on availability_periods
  for select to authenticated using (true);

-- --------------------------------------------------------------------------
-- clubs
-- --------------------------------------------------------------------------
drop policy if exists clubs_read_own on clubs;
create policy clubs_read_own on clubs
  for select to authenticated
  using (app_is_club_member(id) or app_is_club_admin(id));

drop policy if exists clubs_admin_update on clubs;
create policy clubs_admin_update on clubs
  for update to authenticated
  using (app_is_club_admin(id))
  with check (app_is_club_admin(id));

-- No insert/delete policy: clubs are provisioned server-side with the
-- service role (see scripts/provision-club.mjs).

-- --------------------------------------------------------------------------
-- club_admins — a leader sees only their own administrative record.
-- Members have no policy here at all, so they cannot enumerate leaders.
-- --------------------------------------------------------------------------
drop policy if exists club_admins_read_self on club_admins;
create policy club_admins_read_self on club_admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists club_admins_update_self on club_admins;
create policy club_admins_update_self on club_admins
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- members — strictly self. There is deliberately no leader policy.
-- --------------------------------------------------------------------------
drop policy if exists members_read_self on members;
create policy members_read_self on members
  for select to authenticated using (id = auth.uid());

drop policy if exists members_update_self on members;
create policy members_update_self on members
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists members_delete_self on members;
create policy members_delete_self on members
  for delete to authenticated using (id = auth.uid());

-- --------------------------------------------------------------------------
-- club_memberships — self only. Joining goes through join_club_with_code().
-- --------------------------------------------------------------------------
drop policy if exists memberships_read_self on club_memberships;
create policy memberships_read_self on club_memberships
  for select to authenticated using (member_id = auth.uid());

drop policy if exists memberships_delete_self on club_memberships;
create policy memberships_delete_self on club_memberships
  for delete to authenticated using (member_id = auth.uid());

-- --------------------------------------------------------------------------
-- availability + windows + status — self only, always scoped to a club the
-- member actually belongs to.
-- --------------------------------------------------------------------------
drop policy if exists availability_rw_self on availability;
create policy availability_rw_self on availability
  for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid() and app_is_club_member(club_id));

drop policy if exists availability_windows_rw_self on availability_windows;
create policy availability_windows_rw_self on availability_windows
  for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid() and app_is_club_member(club_id));

drop policy if exists availability_status_read_self on availability_status;
create policy availability_status_read_self on availability_status
  for select to authenticated using (member_id = auth.uid());

drop policy if exists availability_status_write_self on availability_status;
create policy availability_status_write_self on availability_status
  for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid() and app_is_club_member(club_id));

-- --------------------------------------------------------------------------
-- meetings — members read their clubs' meetings; leaders manage their own.
-- --------------------------------------------------------------------------
drop policy if exists meetings_read on meetings;
create policy meetings_read on meetings
  for select to authenticated
  using (app_is_club_member(club_id) or app_is_club_admin(club_id));

drop policy if exists meetings_admin_insert on meetings;
create policy meetings_admin_insert on meetings
  for insert to authenticated
  with check (app_is_club_admin(club_id));

drop policy if exists meetings_admin_update on meetings;
create policy meetings_admin_update on meetings
  for update to authenticated
  using (app_is_club_admin(club_id))
  with check (app_is_club_admin(club_id));

drop policy if exists meetings_admin_delete on meetings;
create policy meetings_admin_delete on meetings
  for delete to authenticated using (app_is_club_admin(club_id));

-- --------------------------------------------------------------------------
-- notifications — self only. Inserts come from the fan-out trigger
-- (SECURITY DEFINER) or the service role, never from a client.
-- --------------------------------------------------------------------------
drop policy if exists notifications_read_self on notifications;
create policy notifications_read_self on notifications
  for select to authenticated using (member_id = auth.uid());

drop policy if exists notifications_update_self on notifications;
create policy notifications_update_self on notifications
  for update to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

drop policy if exists notifications_delete_self on notifications;
create policy notifications_delete_self on notifications
  for delete to authenticated using (member_id = auth.uid());

-- --------------------------------------------------------------------------
-- push_subscriptions — self only, for members and leaders alike.
-- --------------------------------------------------------------------------
drop policy if exists push_rw_self on push_subscriptions;
create policy push_rw_self on push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- Grants. RLS does the authorisation; these grants just open the door.
-- `anon` gets nothing: every ClubSync read requires a signed-in session.
-- ============================================================================
grant usage on schema public to anon, authenticated, service_role;

revoke all on all tables in schema public from anon;

grant select on availability_periods to authenticated;
grant select, update on clubs to authenticated;
grant select, update on club_admins to authenticated;
grant select, update, delete on members to authenticated;
grant select, delete on club_memberships to authenticated;
grant select, insert, update, delete on availability to authenticated;
grant select, insert, update, delete on availability_windows to authenticated;
grant select, insert, update, delete on availability_status to authenticated;
grant select, insert, update, delete on meetings to authenticated;
grant select, update, delete on notifications to authenticated;
grant select, insert, update, delete on push_subscriptions to authenticated;

grant all on all tables in schema public to service_role;

-- Function execution
revoke all on function lookup_club_by_code(text) from public;
revoke all on function join_club_with_code(text) from public;
revoke all on function replace_availability(uuid, jsonb, jsonb) from public;
revoke all on function leave_club(uuid) from public;
revoke all on function club_overview(uuid) from public;
revoke all on function club_availability_matrix(uuid) from public;
revoke all on function club_day_totals(uuid) from public;
revoke all on function club_period_totals(uuid) from public;
revoke all on function club_best_times(uuid, integer) from public;
revoke all on function club_slot_estimate(uuid, date, text, time, time) from public;
revoke all on function club_window_histogram(uuid) from public;

grant execute on function lookup_club_by_code(text) to authenticated;
grant execute on function join_club_with_code(text) to authenticated;
grant execute on function replace_availability(uuid, jsonb, jsonb) to authenticated;
grant execute on function leave_club(uuid) to authenticated;
grant execute on function club_overview(uuid) to authenticated;
grant execute on function club_availability_matrix(uuid) to authenticated;
grant execute on function club_day_totals(uuid) to authenticated;
grant execute on function club_period_totals(uuid) to authenticated;
grant execute on function club_best_times(uuid, integer) to authenticated;
grant execute on function club_slot_estimate(uuid, date, text, time, time) to authenticated;
grant execute on function club_window_histogram(uuid) to authenticated;

grant execute on function app_is_club_admin(uuid) to authenticated;
grant execute on function app_is_club_member(uuid) to authenticated;
