import { NextResponse } from "next/server";

import { asString, jsonError, jsonOk, readJson } from "@/lib/api";
import { MIN_PASSWORD_LENGTH, USERNAME_PATTERN, memberEmail } from "@/lib/constants";
import { generateRecoveryPhrase, hashRecoveryPhrase } from "@/lib/recovery";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { hasAdminCredentials, supabaseAdmin } from "@/lib/supabase/admin";

interface Body {
  username?: unknown;
  password?: unknown;
}

/**
 * Create a pseudonymous member account.
 *
 * Runs server-side with the service role for two reasons:
 *   1. the account is created already confirmed, because there is no email
 *      address to send a confirmation link to;
 *   2. the recovery phrase hash is written in the same step, so an account can
 *      never exist without a recovery path.
 */
export async function POST(request: Request) {
  if (!hasAdminCredentials()) {
    return jsonError(
      "ClubSync is not configured for sign-ups yet: SUPABASE_SERVICE_ROLE_KEY is missing on the server.",
      503,
    );
  }

  const limit = rateLimit(clientKey(request, "register"), 8, 600);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many sign-up attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await readJson<Body>(request);
  if (!body) return jsonError("Expected a JSON body.");

  const username = asString(body.username, 40).trim().toLowerCase();
  const password = asString(body.password, 200);

  if (!USERNAME_PATTERN.test(username)) {
    return jsonError(
      "Pick a username of 3–20 characters using lowercase letters, numbers or underscores.",
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return jsonError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const admin = supabaseAdmin();

  const { data: existing } = await admin
    .from("members")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) {
    return jsonError("That username is taken. Try another one.", 409);
  }

  const phrase = generateRecoveryPhrase();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: memberEmail(username),
    password,
    email_confirm: true,
    user_metadata: { app_role: "member", username },
  });

  if (createError || !created?.user) {
    const taken = /already|registered|exists/i.test(createError?.message ?? "");
    return jsonError(
      taken ? "That username is taken. Try another one." : "Could not create the account.",
      taken ? 409 : 500,
    );
  }

  const { error: memberError } = await admin.from("members").insert({
    id: created.user.id,
    username,
    recovery_phrase_hash: hashRecoveryPhrase(phrase),
    recovery_phrase_set_at: new Date().toISOString(),
  });

  if (memberError) {
    // Roll back so a half-created identity cannot linger.
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("[clubsync] member row insert failed:", memberError.message);
    return jsonError("Could not finish creating the account. Nothing was saved.", 500);
  }

  return jsonOk({ username, recoveryPhrase: phrase }, 201);
}
