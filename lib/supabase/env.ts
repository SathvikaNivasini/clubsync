/**
 * Central place where the Supabase configuration is read, so that a missing
 * key produces one clear message instead of a stack trace deep inside a page.
 */

export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

/**
 * ClubSync keeps its tables in their own Postgres schema rather than `public`,
 * so it can share a Supabase project without colliding with another app and
 * without being reachable from it. Override only if you applied the migrations
 * somewhere else; it must match what `supabase/migrations` actually created.
 *
 * The schema has to be listed under Project Settings -> API -> Exposed schemas,
 * or PostgREST will not serve it.
 */
export const DB_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ?? "clubsync";

export function readPublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function requirePublicEnv(): SupabasePublicEnv {
  const env = readPublicEnv();
  if (!env) {
    throw new Error(
      "ClubSync is not configured yet: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see .env.example).",
    );
  }
  return env;
}

export function isConfigured(): boolean {
  return readPublicEnv() !== null;
}
