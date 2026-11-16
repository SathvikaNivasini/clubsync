#!/usr/bin/env bash
# Apply the ClubSync migrations to a Postgres database.
#
#   DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres" \
#     ./scripts/apply-migrations.sh
#
# The connection string is in Supabase under Project Settings -> Database ->
# Connection string -> URI. If you would rather not use psql, paste each file
# in supabase/migrations/ into the Supabase SQL editor in filename order.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set." >&2
  echo 'Example: DATABASE_URL="postgresql://postgres:...@db.ref.supabase.co:5432/postgres" ./scripts/apply-migrations.sh' >&2
  exit 1
fi

cd "$(dirname "$0")/.."

for file in supabase/migrations/*.sql; do
  echo "==> applying $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$file"
done

echo "All migrations applied."
