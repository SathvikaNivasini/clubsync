"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requirePublicEnv } from "./env";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** Browser-side Supabase client. Uses the publishable (anon) key only. */
export function supabaseBrowser() {
  if (!cached) {
    const { url, anonKey } = requirePublicEnv();
    cached = createBrowserClient(url, anonKey);
  }
  return cached;
}
