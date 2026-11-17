import "server-only";

import { createClient } from "@supabase/supabase-js";

import { DB_SCHEMA } from "./env";

/**
 * Service-role client. SERVER ONLY.
 *
 * The `server-only` import above makes the build fail if this module is ever
 * pulled into a client bundle, so the service role key cannot leak to the
 * browser. It is used for exactly three things that a user session cannot do:
 *   1. creating pseudonymous auth accounts at registration,
 *   2. resetting a password from a recovery phrase,
 *   3. reading push subscriptions in order to fan a notification out.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Server-side Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in .env.local (see .env.example). " +
        "SUPABASE_SERVICE_ROLE_KEY must never be prefixed with NEXT_PUBLIC_.",
    );
  }

  return createClient(url, serviceKey, {
    db: { schema: DB_SCHEMA },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function hasAdminCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
