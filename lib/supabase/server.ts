import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { DB_SCHEMA, requirePublicEnv } from "./env";

/**
 * Server-side Supabase client bound to the request's cookies, so every query
 * runs as the signed-in user and Row Level Security applies.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();
  const { url, anonKey } = requirePublicEnv();

  return createServerClient(url, anonKey, {
    db: { schema: DB_SCHEMA },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * The concrete client type, inferred rather than written out. ClubSync targets
 * a non-`public` schema, so the hand-written `SupabaseClient` default (which
 * pins the schema to "public") does not describe this client.
 */
export type AppSupabaseClient = Awaited<ReturnType<typeof supabaseServer>>;
