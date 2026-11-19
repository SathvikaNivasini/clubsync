-- ============================================================================
-- ClubSync — officers propose, students vote
-- ============================================================================
--   1. an OFFICER picks candidate days (before or after school only)
--   2. STUDENTS vote on them before a deadline
--   3. the officer sees the tally and books one
-- Only two slots exist, ever: before_school and after_school.
-- ============================================================================
create schema if not exists clubsync;
set search_path = clubsync, public, pg_temp;
create extension if not exists pgcrypto;

create table clubs (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint clubs_code_format check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9-]{1,15}$'),
  constraint clubs_name_length check (char_length(name) between 2 and 60)
);

create table officers (
  id         uuid primary key references auth.users (id) on delete cascade,
  club_id    uuid not null references clubs (id) on delete cascade,
  handle     text not null unique,
  created_at timestamptz not null default now(),
  constraint officers_handle_format check (handle = upper(handle) and handle ~ '^[A-Z0-9][A-Z0-9-]{1,20}$')
);
create index officers_club_idx on officers (club_id);

create table members (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique,
  created_at timestamptz not null default now(),
  constraint members_username_format check (username = lower(username) and username ~ '^[a-z0-9_]{3,20}$')
);

create table club_memberships (
  club_id   uuid not null references clubs (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, member_id)
);
create index club_memberships_member_idx on club_memberships (member_id);

create table rounds (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs (id) on delete cascade,
  created_by uuid references officers (id) on delete set null,
  deadline   timestamptz not null,
  status     text not null default 'open',
  created_at timestamptz not null default now(),
  constraint rounds_status_valid check (status in ('open', 'closed'))
);
create index rounds_club_idx on rounds (club_id, created_at desc);

create table round_options (
  id        uuid primary key default gen_random_uuid(),
  round_id  uuid not null references rounds (id) on delete cascade,
  slot_date date not null,
  slot      text not null,
  constraint round_options_slot_valid check (slot in ('before_school', 'after_school')),
  constraint round_options_unique unique (round_id, slot_date, slot)
);
create index round_options_round_idx on round_options (round_id);

-- one row per student per option; officers only ever see counts
create table votes (
  id         uuid primary key default gen_random_uuid(),
  option_id  uuid not null references round_options (id) on delete cascade,
  member_id  uuid not null references members (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint votes_unique unique (option_id, member_id)
);
create index votes_option_idx on votes (option_id);
create index votes_member_idx on votes (member_id);

create table meetings (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs (id) on delete cascade,
  round_id   uuid references rounds (id) on delete set null,
  slot_date  date not null,
  slot       text not null,
  location   text,
  created_at timestamptz not null default now(),
  constraint meetings_slot_valid check (slot in ('before_school', 'after_school')),
  constraint meetings_once unique (club_id, slot_date, slot),
  constraint meetings_location_length check (location is null or char_length(location) <= 80)
);
create index meetings_club_idx on meetings (club_id, slot_date);
