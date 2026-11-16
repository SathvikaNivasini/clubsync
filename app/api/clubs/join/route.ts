import { NextResponse } from "next/server";

import { asString, friendlyDbError, jsonError, jsonOk, readJson } from "@/lib/api";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase/server";

interface Body {
  code?: unknown;
}

/**
 * Join a club with its code.
 *
 * Routed through the server so that code guessing is rate limited — the club
 * code is the capability that grants access, so it must not be cheap to
 * enumerate. The actual insert happens in the `join_club_with_code` RPC under
 * the caller's own session.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "join"), 12, 600);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await readJson<Body>(request);
  const code = asString(body?.code, 32).trim().toUpperCase();
  if (code.length < 3) return jsonError("Enter the club code your leader gave you.");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in first.", 401);

  const { data, error } = await supabase.rpc("join_club_with_code", { p_code: code });

  if (error) {
    const message = /no club accepts that code/i.test(error.message)
      ? "No club uses that code. Check it with your club leader."
      : friendlyDbError(error);
    return jsonError(message, 404);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return jsonError("No club uses that code.", 404);

  return jsonOk({
    clubId: row.club_id as string,
    clubName: row.club_name as string,
    memberNumber: row.member_number as number,
    wasNew: row.was_new as boolean,
  });
}
