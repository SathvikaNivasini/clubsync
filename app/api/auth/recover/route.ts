import { NextResponse } from "next/server";

import { asString, jsonError, jsonOk, readJson } from "@/lib/api";
import { MIN_PASSWORD_LENGTH, USERNAME_PATTERN } from "@/lib/constants";
import { normalizePhrase, verifyRecoveryPhrase } from "@/lib/recovery";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { hasAdminCredentials, supabaseAdmin } from "@/lib/supabase/admin";

interface Body {
  username?: unknown;
  phrase?: unknown;
  password?: unknown;
}

/**
 * Reset a member password using the recovery phrase shown at sign-up.
 * There is no email fallback, by design — see /privacy.
 */
export async function POST(request: Request) {
  if (!hasAdminCredentials()) {
    return jsonError("Account recovery is unavailable: the server is missing its service role key.", 503);
  }

  const limit = rateLimit(clientKey(request, "recover"), 5, 900);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many recovery attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await readJson<Body>(request);
  if (!body) return jsonError("Expected a JSON body.");

  const username = asString(body.username, 40).trim().toLowerCase();
  const phrase = normalizePhrase(asString(body.phrase, 400));
  const password = asString(body.password, 200);

  if (!USERNAME_PATTERN.test(username)) return jsonError("Enter your username.");
  if (phrase.split(" ").length < 6) return jsonError("Enter your full twelve-word recovery phrase.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return jsonError(`Use a new password of at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const admin = supabaseAdmin();
  const { data: member } = await admin
    .from("members")
    .select("id, recovery_phrase_hash")
    .eq("username", username)
    .maybeSingle();

  // Deliberately identical response whether the username exists or the phrase
  // is wrong, so this endpoint cannot be used to discover who has an account.
  const generic = "That username and recovery phrase do not match.";
  if (!member) return jsonError(generic, 401);

  const row = member as { id: string; recovery_phrase_hash: string | null };
  if (!verifyRecoveryPhrase(phrase, row.recovery_phrase_hash)) {
    return jsonError(generic, 401);
  }

  const { error } = await admin.auth.admin.updateUserById(row.id, { password });
  if (error) {
    console.error("[clubsync] password reset failed:", error.message);
    return jsonError("Could not reset the password. Try again.", 500);
  }

  return jsonOk({ username });
}
