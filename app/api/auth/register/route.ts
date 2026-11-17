import { asString, jsonError, jsonOk, readJson } from "@/lib/api";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { hasAdminCredentials, supabaseAdmin } from "@/lib/supabase/admin";
import { MIN_PASSWORD, loginEmail } from "@/lib/slots";

const USERNAME = /^[a-z0-9_]{3,20}$/;

/** Student sign-up. Server-side because the account is created already
 *  confirmed — there is no email address to confirm. */
export async function POST(request: Request) {
  if (!hasAdminCredentials()) {
    return jsonError("Sign-ups are not configured on this deployment.", 503);
  }
  const limit = rateLimit(clientKey(request, "register"), 10, 600);
  if (!limit.ok) return jsonError("Too many tries. Wait a few minutes.", 429);

  const body = await readJson<{ username?: unknown; password?: unknown; code?: unknown }>(request);
  const username = asString(body?.username, 40).trim().toLowerCase();
  const password = asString(body?.password, 200);
  const code = asString(body?.code, 32).trim().toUpperCase();

  if (!USERNAME.test(username)) {
    return jsonError("Usernames are 3–20 lowercase letters, numbers or underscores.");
  }
  if (password.length < MIN_PASSWORD) {
    return jsonError(`Password needs at least ${MIN_PASSWORD} characters.`);
  }

  const admin = supabaseAdmin();

  const { data: taken } = await admin.from("members").select("id").eq("username", username).maybeSingle();
  if (taken) return jsonError("That username is taken.", 409);

  if (code) {
    const { data: club } = await admin.from("clubs").select("id").eq("code", code).maybeSingle();
    if (!club) return jsonError("No club has that code.", 404);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginEmail(username, "student"),
    password,
    email_confirm: true,
    user_metadata: { app_role: "student", handle: username },
  });
  if (createError || !created?.user) {
    return jsonError(/already|exists/i.test(createError?.message ?? "") ? "That username is taken." : "Could not create the account.", 409);
  }

  const { error: memberError } = await admin.from("members").insert({ id: created.user.id, username });
  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return jsonError("Could not finish creating the account.", 500);
  }

  if (code) {
    const { data: club } = await admin.from("clubs").select("id").eq("code", code).maybeSingle();
    if (club) {
      await admin.from("club_memberships").insert({ club_id: (club as { id: string }).id, member_id: created.user.id });
    }
  }

  return jsonOk({ username }, 201);
}
