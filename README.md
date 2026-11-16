# ClubSync

Anonymous availability collection and meeting scheduling for school clubs.

Members say when they are free without giving a name, an email address or a
phone number. Leaders see aggregate counts, a ranked best-time recommendation,
and publish meetings that notify the whole club.

---

## Status

| Area | State |
|---|---|
| Database schema, constraints, indexes, RLS, aggregate RPCs | Complete, **verified** — 60 assertions pass against PostgreSQL 16 |
| Authentication (pseudonymous members, provisioned club leaders, recovery phrase) | Complete |
| Availability collection (7×4 grid, drag-select, custom time ranges) | Complete |
| Leader analytics (heatmap, bar charts, best-time recommendation) | Complete |
| Meeting scheduler, editor, cancellation, calendar | Complete |
| Web Push + in-app notification centre | Complete; needs VAPID keys to deliver |
| Meeting reminders | Complete; needs an external scheduler to call the endpoint |
| **Live Supabase project** | **Not provisioned — see Setup** |

Nothing in the application uses mock data. Every page reads through Supabase,
so the interface stays empty until the database below is connected.

---

## Setup

### 1. Create a Supabase project

<https://supabase.com/dashboard> → New project. Keep the database password.

### 2. Configure the environment

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → Data API** and **Project Settings → API Keys**:

- `NEXT_PUBLIC_SUPABASE_URL` — the project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon / publishable key (safe in the browser)
- `SUPABASE_SERVICE_ROLE_KEY` — the service_role key (**server only**, never `NEXT_PUBLIC_`)

### 3. Apply the migrations

Either with psql:

```bash
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT-REF.supabase.co:5432/postgres" ./scripts/apply-migrations.sh
```

Or paste each file in `supabase/migrations/` into the Supabase SQL editor, in
filename order. Do **not** apply `supabase/local-shim.sql` to Supabase — that
file only exists to recreate the platform's `auth` schema for local tests.

### 4. Install and run

```bash
npm install
```

```bash
npm run dev
```

### 5. Create a club

```bash
node --env-file=.env.local scripts/provision-club.mjs --code CCTIA --name "CCTIA" --school "Your High School"
```

This prints the club code and a generated one-time leader password. There is no
shared or default password anywhere in ClubSync, and the leader is prompted to
change theirs on first sign-in. Share the **club code** with members; they sign
up at `/register` and join at `/join`.

### 6. Optional — demonstration data

```bash
node --env-file=.env.local scripts/seed-demo.mjs
```

Creates two clearly-labelled demo clubs (`DEMO-CCTIA`, `DEMO-ROBOTICS`), twelve
`demo_*` member accounts with an uneven availability pattern, and one published
meeting — enough to see every chart populated. Remove it with `--remove`.
Demo clubs are flagged `is_demo = true` in the database.

### 7. Optional — push notifications

```bash
node scripts/generate-vapid-keys.mjs
```

Add the three printed variables to `.env.local` and restart. Without them, push
is disabled and the interface says so rather than pretending otherwise; the
in-app notification centre keeps the full history either way.

### 8. Optional — meeting reminders

Set `CRON_SECRET` in `.env.local`, then have a scheduler call the endpoint
every 10–15 minutes:

```bash
curl -X POST https://your-deployment/api/push/reminders -H "Authorization: Bearer $CRON_SECRET"
```

On Vercel, add to `vercel.json`:

```json
{ "crons": [{ "path": "/api/push/reminders", "schedule": "*/15 * * * *" }] }
```

Until a scheduler exists, reminders are never sent. Notifications for
scheduling, rescheduling and cancelling do not depend on it.

---

## Checks

```bash
npm run check
```

Runs `typecheck`, `lint`, `test` and `build`. The database suite is separate
because it needs a local PostgreSQL server:

```bash
npm run db:verify
```

This creates a throwaway `clubsync_test` database, applies the shim and every
migration, then runs `supabase/tests/privacy_rls_test.sql` — 60 assertions
covering member isolation, leader blindness, aggregate correctness, notification
fan-out, club joining, the anonymous role, and every schema constraint.

---

## Privacy model

The guarantee is enforced in the database, not in the interface.

| Table | Member (own rows) | Club leader |
|---|---|---|
| `members` | full | **none** |
| `club_memberships` | full | **none** — counts via RPC only |
| `availability` | full | **none** — counts via RPC only |
| `availability_windows` | full | **none** — counts via RPC only |
| `availability_status` | read | **none** — counts via RPC only |
| `clubs` | read (joined only) | read + update (own club) |
| `club_admins` | **none** | read + limited update (self) |
| `meetings` | read (joined only) | full (own club) |
| `notifications` | full | **none** |
| `push_subscriptions` | own rows | own rows |

A leader querying `members` or `availability` directly gets zero rows. Every
number on a leader's dashboard comes from a `SECURITY DEFINER` aggregate
function that returns counts and has no code path returning a member id.

There is no column anywhere for a real name, email address, phone number or
student ID, so none can be collected without a schema change. A test asserts
this (`members table has no column that could hold PII`).

`/privacy` is the user-facing version of this, including the parts that are not
flattering: aggregates leak information in very small clubs, and hosting and
push infrastructure still process technical metadata.

### Account recovery

No email means no reset link. Members get a twelve-word recovery phrase once, at
sign-up; only a salted scrypt hash is stored. **If both the password and the
phrase are lost, the account cannot be recovered by anyone.** The sign-up flow
says this before the member continues.

---

## Architecture

```
app/
  (auth)/           login, register, recover — centred card layout
  (app)/            member + leader pages, shared shell with role-aware nav
    dashboard/  availability/  calendar/  notifications/  join/  account/
    leader/     leader/analytics/  leader/meetings/  leader/meetings/new/
                leader/meetings/[id]/  leader/settings/
  api/              auth, clubs, meetings, push route handlers
  page.tsx          landing     privacy/   privacy disclosure
components/
  availability/ calendar/ charts/ clubs/ meetings/ notifications/ account/
  layout/  ui/
lib/
  supabase/         browser, server (cookie-bound), admin (service role)
  auth.ts           viewer resolution + route guards
  leader.ts         the aggregate RPC wrappers
  meetings.ts       meeting queries with club colour resolution
  recovery.ts       recovery phrase generation + scrypt hashing
  push.ts           Web Push delivery, dead-subscription pruning
  viz.ts            validated chart palettes
proxy.ts            session refresh + role-based route guards
supabase/
  migrations/       0001 schema · 0002 triggers · 0003 RPCs · 0004 RLS
  tests/            privacy + RLS suite
  local-shim.sql    local-only Supabase platform stand-in
scripts/            provisioning, seeding, VAPID keys, migrations, verification
```

### Authentication

Supabase Auth, with a synthetic identifier derived from the pseudonym:
`quietfox@members.clubsync.invalid`. `.invalid` is reserved by RFC 2606 and can
never resolve or receive mail — nothing here is a reachable address. Passwords
are hashed by Supabase Auth; ClubSync's own code never sees one.

Registration runs server-side with the service role so the account is created
already confirmed (there is no address to confirm) and the recovery hash is
written in the same step. A failure rolls the auth user back.

### Charts

Chart colour is computed, not chosen by eye. Both palettes in `lib/viz.ts` were
checked with a validator against the chart surface `#191F29`:

- **Club identity** — categorical, 5 slots, all-pairs: lightness band, chroma
  floor, colour-vision separation, normal-vision floor and contrast all pass. An
  all-pairs check caps out near 5–6 slots on a dark surface, so a sixth club
  reuses a colour; this is safe because the club name always appears beside the
  swatch.
- **Availability heatmap** — sequential, single hue (OKLCH h≈181), 5 steps:
  monotone lightness, adjacent ΔL ≥ 0.06, light-end contrast 2.44:1, single hue.

Zero-availability cells use a colour outside the ramp, because "nobody is free"
is a state rather than a magnitude. Every chart also exposes its numbers as a
table.

---

## Deployment notes

- Set every variable from `.env.example` in the host's environment.
  `SUPABASE_SERVICE_ROLE_KEY` must not carry the `NEXT_PUBLIC_` prefix;
  `lib/supabase/admin.ts` imports `server-only`, so a client import fails the build.
- `/sw.js` is served from the origin root with `Service-Worker-Allowed: /`.
- The rate limiter in `lib/rate-limit.ts` is per-instance and in-memory. Behind
  several instances, move the counters to Postgres or Redis.
- Reminders need the scheduler from step 8.
