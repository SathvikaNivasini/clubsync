-- ============================================================================
-- ClubSync v2 — Row Level Security
-- ============================================================================
-- Students stay anonymous: officers read vote COUNTS through officer_results(),
-- and have no row-level access to `votes` or `members` at all.
-- ============================================================================
set search_path = clubsync, public, pg_temp;

alter table clubs            enable row level security;
alter table sponsors         enable row level security;
alter table club_sponsors    enable row level security;
alter table officers         enable row level security;
alter table members          enable row level security;
alter table club_memberships enable row level security;
alter table sponsor_slots    enable row level security;
alter table rounds           enable row level security;
alter table round_options    enable row level security;
alter table votes            enable row level security;
alter table meetings         enable row level security;

-- clubs: visible to anyone attached to them
create policy clubs_read on clubs for select to authenticated
  using (app_is_member_of(id) or app_is_officer_of(id) or app_is_sponsor_of(id));

-- own profile rows only
create policy sponsors_self on sponsors for select to authenticated using (id = auth.uid());
create policy officers_self on officers for select to authenticated using (id = auth.uid());
create policy officers_update_self on officers for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy members_self on members for select to authenticated using (id = auth.uid());

create policy club_sponsors_read on club_sponsors for select to authenticated
  using (sponsor_id = auth.uid() or app_is_officer_of(club_id));

-- a student sees only their own membership rows; nobody else sees any
create policy memberships_self on club_memberships for select to authenticated
  using (member_id = auth.uid());

-- sponsor_slots: the sponsor owns them; officers read them through officer_slots()
create policy sponsor_slots_own on sponsor_slots for all to authenticated
  using (sponsor_id = auth.uid()) with check (sponsor_id = auth.uid());

-- rounds and options are readable by the club's officer and its students
create policy rounds_read on rounds for select to authenticated
  using (app_is_officer_of(club_id) or app_is_member_of(club_id));

create policy round_options_read on round_options for select to authenticated
  using (exists (select 1 from rounds r where r.id = round_id
                  and (app_is_officer_of(r.club_id) or app_is_member_of(r.club_id))));

-- votes: strictly the student's own. Officers get counts via RPC, never rows.
create policy votes_own on votes for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- meetings: everyone attached to the club can read; writes go through RPCs
create policy meetings_read on meetings for select to authenticated
  using (app_is_member_of(club_id) or app_is_officer_of(club_id) or app_is_sponsor_of(club_id));

-- ============================================================================
-- Grants — scoped to this schema only; the host project's `public` is untouched
-- ============================================================================
grant usage on schema clubsync to anon, authenticated, service_role;
revoke all on all tables in schema clubsync from anon;

grant select on clubs, sponsors, officers, members, club_sponsors, club_memberships,
                rounds, round_options, meetings to authenticated;
grant update on officers to authenticated;
grant select, insert, update, delete on sponsor_slots to authenticated;
grant select, insert, delete on votes to authenticated;
grant all on all tables in schema clubsync to service_role;

do $$
declare fn text;
begin
  for fn in
    select format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'clubsync'
  loop
    execute format('revoke all on function clubsync.%s from public', fn);
    execute format('grant execute on function clubsync.%s to authenticated', fn);
  end loop;
end $$;
