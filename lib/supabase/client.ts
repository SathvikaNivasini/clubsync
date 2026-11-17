"use client";

import { createBrowserClient } from "@supabase/ssr";
import { DB_SCHEMA, requirePublicEnv } from "./env";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** Browser-side Supabase client. Uses the publishable (anon) key only. */
export function supabaseBrowser() {
  if (!cached) {
    const { url, anonKey } = requirePublicEnv();
    cached = createBrowserClient(url, anonKey, { db: { schema: DB_SCHEMA } });
  }
  return cached;
}
