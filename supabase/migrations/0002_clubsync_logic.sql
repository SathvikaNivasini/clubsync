-- ============================================================================
-- ClubSync — helper functions, triggers, RPCs and Row Level Security
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Authorisation helpers.
-- SECURITY DEFINER so that policies can call them without recursing into the
-- RLS of the tables they inspect.
-- ---------------------------------------------------------------------------
create or replace function app_is_club_admin(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from club_admins ca
    where ca.club_id = p_club and ca.user_id = auth.uid()
  );
$$;

create or replace function app_is_club_member(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from club_memberships cm
    where cm.club_id = p_club and cm.member_id = auth.uid()
  );
$$;

create or replace function app_require_club_admin(p_club uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'clubsync: authentication required' using errcode = '28000';
  end if;
  if not app_is_club_admin(p_club) then
    raise exception 'clubsync: not an administrator of this club' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------
create or replace function app_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists clubs_touch on clubs;
create trigger clubs_touch before update on clubs
  for each row execute function app_touch_updated_at();

drop trigger if exists members_touch on members;
create trigger members_touch before update on members
  for each row execute function app_touch_updated_at();

drop trigger if exists meetings_touch on meetings;
create trigger meetings_touch before update on meetings
  for each row execute function app_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Per-club anonymous member number ("Member #7"), assigned on join.
-- SECURITY DEFINER because the inserting member cannot read other rows.
-- ---------------------------------------------------------------------------
create or replace function app_assign_member_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.member_number is null or new.member_number = 0 then
    select coalesce(max(member_number), 0) + 1
      into new.member_number
      from club_memberships
     where club_id = new.club_id;
  end if;
  return new;
end;
$$;

drop trigger if exists club_memberships_number on club_memberships;
create trigger club_memberships_number before insert on club_memberships
  for each row execute function app_assign_member_number();

-- ---------------------------------------------------------------------------
-- availability_status maintenance
-- ---------------------------------------------------------------------------
create or replace function app_refresh_availability_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club   uuid := coalesce(new.club_id, old.club_id);
  v_member uuid := coalesce(new.member_id, old.member_id);
  v_slots  integer;
  v_windows integer;
begin
  select count(*) into v_slots
    from availability where club_id = v_club and member_id = v_member;
  select count(*) into v_windows
    from availability_windows where club_id = v_club and member_id = v_member;

  if not exists (select 1 from club_memberships where club_id = v_club and member_id = v_member) then
    return null;
  end if;

  insert into availability_status (club_id, member_id, slot_count, window_count, updated_at)
  values (v_club, v_member, v_slots, v_windows, now())
  on conflict (club_id, member_id) do update
    set slot_count = excluded.slot_count,
        window_count = excluded.window_count,
        updated_at = now();
  return null;
end;
$$;

drop trigger if exists availability_status_sync on availability;
create trigger availability_status_sync
  after insert or delete or update on availability
  for each row execute function app_refresh_availability_status();

drop trigger if exists availability_windows_status_sync on availability_windows;
create trigger availability_windows_status_sync
  after insert or delete or update on availability_windows
  for each row execute function app_refresh_availability_status();

-- ---------------------------------------------------------------------------
-- Meeting notification fan-out.
-- Runs in-database so every write path (API route, RPC, dashboard) produces
-- consistent notifications. Web Push delivery is layered on top of this.
-- ---------------------------------------------------------------------------
create or replace function app_fanout_meeting_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind      text;
  v_title     text;
  v_body      text;
  v_club_name text;
  v_when      text;
begin
  select name into v_club_name from clubs where id = new.club_id;
  v_when := to_char(new.meeting_date, 'Dy FMDD Mon') || ' at ' ||
            ltrim(to_char(new.starts_at, 'HH:MI AM'), '0');

  if tg_op = 'INSERT' then
    if new.status <> 'scheduled' then
      return null;
    end if;
    v_kind  := 'meeting_scheduled';
    v_title := v_club_name || ': new meeting';
    v_body  := new.title || ' — ' || v_when ||
               coalesce(' · ' || new.location, '');
  else
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      v_kind  := 'meeting_cancelled';
      v_title := v_club_name || ': meeting cancelled';
      v_body  := new.title || ' on ' || v_when || ' has been cancelled.';
    elsif new.status = 'scheduled' and (
            old.meeting_date <> new.meeting_date
         or old.starts_at <> new.starts_at
         or old.ends_at <> new.ends_at
         or coalesce(old.location, '') <> coalesce(new.location, '')
         or old.title <> new.title
         or coalesce(old.description, '') <> coalesce(new.description, '')
    ) then
      v_kind  := 'meeting_updated';
      v_title := v_club_name || ': meeting updated';
      v_body  := new.title || ' is now ' || v_when ||
                 coalesce(' · ' || new.location, '');
    else
      return null;
    end if;
  end if;

  insert into notifications (member_id, club_id, meeting_id, kind, title, body)
  select cm.member_id, new.club_id, new.id, v_kind, left(v_title, 160), left(v_body, 600)
    from club_memberships cm
   where cm.club_id = new.club_id;

  return null;
end;
$$;

drop trigger if exists meetings_fanout_insert on meetings;
create trigger meetings_fanout_insert after insert on meetings
  for each row execute function app_fanout_meeting_notification();

drop trigger if exists meetings_fanout_update on meetings;
create trigger meetings_fanout_update after update on meetings
  for each row execute function app_fanout_meeting_notification();

-- Guard: an admin row must never be repointed at another club or user.
create or replace function app_lock_admin_identity()
returns trigger
language plpgsql
as $$
begin
  if new.club_id <> old.club_id or new.user_id <> old.user_id
     or new.admin_handle <> old.admin_handle then
    raise exception 'clubsync: administrator identity is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists club_admins_identity_lock on club_admins;
create trigger club_admins_identity_lock before update on club_admins
  for each row execute function app_lock_admin_identity();

-- A member must never be able to rename themselves into another identity.
create or replace function app_lock_username()
returns trigger
language plpgsql
as $$
begin
  if new.username <> old.username then
    raise exception 'clubsync: username is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists members_username_lock on members;
create trigger members_username_lock before update on members
  for each row execute function app_lock_username();
