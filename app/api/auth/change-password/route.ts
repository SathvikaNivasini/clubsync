import { asString, jsonError, jsonOk, readJson } from "@/lib/api";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { supabaseServer } from "@/lib/supabase/server";

interface Body {
  currentPassword?: unknown;
  newPassword?: unknown;
}

/**
 * Change your own password. Uses the caller's session only — no service role —
 * and re-authenticates with the current password first so a borrowed browser
 * tab cannot silently take over an account.
 */
export async function POST(request: Request) {
  const body = await readJson<Body>(request);
  if (!body) return jsonError("Expected a JSON body.");

  const currentPassword = asString(body.currentPassword, 200);
  const newPassword = asString(body.newPassword, 200);

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return jsonError(`Use a new password of at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (newPassword === currentPassword) {
    return jsonError("The new password must be different from the current one.");
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return jsonError("You are not signed in.", 401);

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) return jsonError("That current password is not right.", 401);

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return jsonError("Could not update the password.", 500);

  // A leader provisioned with a one-time password has now chosen their own.
  await supabase
    .from("club_admins")
    .update({ must_change_password: false })
    .eq("user_id", user.id);

  return jsonOk({ changed: true });
}
