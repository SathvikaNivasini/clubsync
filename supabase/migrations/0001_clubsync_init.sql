-- ============================================================================
-- ClubSync — initial schema
-- ============================================================================
-- Privacy model (this is a product requirement, enforced structurally):
--   * No table in this schema has a column for a real name, email address,
--     phone number, or school ID. Members are pseudonymous usernames only.
--   * Club leaders have NO row-level read access to `members`,
--     `club_memberships`, `availability`, or `availability_windows`.
--     Everything a leader sees about availability comes from the aggregate
--     SECURITY DEFINER functions at the bottom of this file, which return
--     counts only and never a member id.
--
-- Day-of-week convention used everywhere: 0 = Monday ... 6 = Sunday.
-- ============================================================================

-- ClubSync lives in its own schema so it can share a Supabase project
-- without colliding with, or being reachable from, another app's tables.
-- Dropping this one schema removes ClubSync completely.
create schema if not exists clubsync;
set search_path = clubsync, public, pg_temp;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Reference: availability periods
-- ---------------------------------------------------------------------------
create table if not exists availability_periods (
  key         text primary key,
  label       text not null,
  sort_order  smallint not null unique,
  typical_start time not null,
  typical_end   time not null
);

insert into availability_periods (key, label, sort_order, typical_start, typical_end) values
  ('before_school', 'Before School', 1, '07:00', '08:00'),
  ('lunch',         'During Lunch',  2, '11:30', '12:30'),
  ('after_school',  'After School',  3, '15:15', '17:00'),
  ('evening',       'Evening',       4, '18:30', '20:30')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------------
create table if not exists clubs (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  description   text,
  school        text,
  accent_color  text not null default '#35C6B1',
  timezone      text not null default 'America/New_York',
  join_enabled  boolean not null default true,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint clubs_code_unique unique (code),
  constraint clubs_code_format check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9-]{2,15}$'),
  constraint clubs_name_length check (char_length(name) between 2 and 80),
  constraint clubs_description_length check (description is null or char_length(description) <= 600),
  constraint clubs_school_length check (school is null or char_length(school) <= 120),
  constraint clubs_accent_format check (accent_color ~* '^#[0-9a-f]{6}$')
);

-- ---------------------------------------------------------------------------
-- club_admins — one administrative identity per club leader account
-- ---------------------------------------------------------------------------
create table if not exists club_admins (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references clubs (id) on delete cascade,
  user_id              uuid not null references auth.users (id) on delete cascade,
  admin_handle         text not null,
  display_name         text,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now(),
  last_login_at        timestamptz,
  constraint club_admins_user_unique unique (user_id),
  constraint club_admins_handle_unique unique (admin_handle),
  constraint club_admins_handle_format check (admin_handle = upper(admin_handle) and admin_handle ~ '^[A-Z0-9][A-Z0-9-]{2,15}$'),
  constraint club_admins_display_length check (display_name is null or char_length(display_name) <= 80)
);

create index if not exists club_admins_club_idx on club_admins (club_id);

-- ---------------------------------------------------------------------------
-- members — pseudonymous student accounts. No PII columns, by design.
-- ---------------------------------------------------------------------------
create table if not exists members (
  id                     uuid primary key references auth.users (id) on delete cascade,
  username               text not null,
  recovery_phrase_hash   text,
  recovery_phrase_set_at timestamptz,
  notifications_enabled  boolean not null default true,
  reminder_lead_minutes  smallint not null default 60,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint members_username_unique unique (username),
  constraint members_username_format check (username = lower(username) and username ~ '^[a-z0-9_]{3,20}$'),
  constraint members_reminder_range check (reminder_lead_minutes between 10 and 1440)
);

-- ---------------------------------------------------------------------------
-- club_memberships — a member may belong to many clubs with one account
-- ---------------------------------------------------------------------------
create table if not exists club_memberships (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references clubs (id) on delete cascade,
  member_id     uuid not null references members (id) on delete cascade,
  member_number integer not null,
  joined_at     timestamptz not null default now(),
  constraint club_memberships_unique unique (club_id, member_id),
  constraint club_memberships_number_unique unique (club_id, member_number),
  constraint club_memberships_number_positive check (member_number > 0)
);

create index if not exists club_memberships_member_idx on club_memberships (member_id);
create index if not exists club_memberships_club_idx on club_memberships (club_id);

-- ---------------------------------------------------------------------------
-- availability — one row per (member, club, day, period) the member can attend
-- ---------------------------------------------------------------------------
create table if not exists availability (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  member_id   uuid not null,
  day_of_week smallint not null,
  period      text not null references availability_periods (key),
  created_at  timestamptz not null default now(),
  constraint availability_unique unique (club_id, member_id, day_of_week, period),
  constraint availability_day_range check (day_of_week between 0 and 6),
  constraint availability_membership_fk foreign key (club_id, member_id)
    references club_memberships (club_id, member_id) on delete cascade
);

create index if not exists availability_club_idx on availability (club_id);
create index if not exists availability_club_slot_idx on availability (club_id, day_of_week, period);
create index if not exists availability_member_idx on availability (member_id);

-- ---------------------------------------------------------------------------
-- availability_windows — optional, more precise custom time ranges
-- ---------------------------------------------------------------------------
create table if not exists availability_windows (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  member_id   uuid not null,
  day_of_week smallint not null,
  starts_at   time not null,
  ends_at     time not null,
  created_at  timestamptz not null default now(),
  constraint availability_windows_day_range check (day_of_week between 0 and 6),
  constraint availability_windows_order check (ends_at > starts_at),
  constraint availability_windows_unique unique (club_id, member_id, day_of_week, starts_at, ends_at),
  constraint availability_windows_membership_fk foreign key (club_id, member_id)
    references club_memberships (club_id, member_id) on delete cascade
);

create index if not exists availability_windows_club_idx on availability_windows (club_id, day_of_week);

-- ---------------------------------------------------------------------------
-- availability_status — trigger-maintained submission state.
-- Lets leaders count "submitted vs not submitted" without any read access
-- to the availability rows themselves.
-- ---------------------------------------------------------------------------
create table if not exists availability_status (
  club_id      uuid not null,
  member_id    uuid not null,
  slot_count   integer not null default 0,
  window_count integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (club_id, member_id),
  constraint availability_status_membership_fk foreign key (club_id, member_id)
    references club_memberships (club_id, member_id) on delete cascade,
  constraint availability_status_counts check (slot_count >= 0 and window_count >= 0)
);

create index if not exists availability_status_club_idx on availability_status (club_id);

-- ---------------------------------------------------------------------------
-- meetings
-- ---------------------------------------------------------------------------
create table if not exists meetings (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null references clubs (id) on delete cascade,
  title               text not null,
  description         text,
  location            text,
  meeting_date        date not null,
  starts_at           time not null,
  ends_at             time not null,
  period_hint         text references availability_periods (key),
  status              text not null default 'scheduled',
  estimated_available integer,
  estimated_total     integer,
  cancellation_reason text,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint meetings_title_length check (char_length(title) between 2 and 120),
  constraint meetings_description_length check (description is null or char_length(description) <= 2000),
  constraint meetings_location_length check (location is null or char_length(location) <= 160),
  constraint meetings_time_order check (ends_at > starts_at),
  constraint meetings_status_valid check (status in ('scheduled', 'cancelled', 'completed')),
  constraint meetings_reason_length check (cancellation_reason is null or char_length(cancellation_reason) <= 400),
  constraint meetings_estimate_sane check (
    estimated_available is null or estimated_total is null or estimated_available <= estimated_total
  )
);

create index if not exists meetings_club_date_idx on meetings (club_id, meeting_date desc);
create index if not exists meetings_date_idx on meetings (meeting_date) where status = 'scheduled';

-- ---------------------------------------------------------------------------
-- notifications — in-app notification centre (push fallback)
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members (id) on delete cascade,
  club_id    uuid references clubs (id) on delete cascade,
  meeting_id uuid references meetings (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_kind_valid check (kind in (
    'meeting_scheduled', 'meeting_updated', 'meeting_cancelled',
    'meeting_reminder', 'club_joined', 'system'
  )),
  constraint notifications_title_length check (char_length(title) between 1 and 160),
  constraint notifications_body_length check (char_length(body) between 1 and 600)
);

create index if not exists notifications_member_idx on notifications (member_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (member_id) where read_at is null;
create unique index if not exists notifications_reminder_once_idx
  on notifications (member_id, meeting_id, kind)
  where kind = 'meeting_reminder';

-- ---------------------------------------------------------------------------
-- push_subscriptions — Web Push endpoints. Stores a coarse device label only.
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth_key      text not null,
  device_label  text,
  failure_count smallint not null default 0,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_label_length check (device_label is null or char_length(device_label) <= 40)
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
