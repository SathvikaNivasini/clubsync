#!/usr/bin/env bash
# Run the ClubSync schema and privacy test suite against a throwaway local
# PostgreSQL database. Needs a local postgres server and psql on PATH.
#
#   ./scripts/verify-local.sh
#
# This does not touch Supabase. It applies supabase/local-shim.sql (which
# recreates just enough of the Supabase platform: the anon/authenticated/
# service_role roles, auth.users and auth.uid()), then every migration, then
# supabase/tests/chain_test.sql.
set -euo pipefail

cd "$(dirname "$0")/.."

DB="${CLUBSYNC_TEST_DB:-clubsync_test}"

dropdb --if-exists "$DB"
createdb "$DB"

psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/local-shim.sql
for file in supabase/migrations/*.sql; do
  echo "==> $file"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$file"
done

psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/chain_test.sql
