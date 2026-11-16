import { jsonError, jsonOk } from "@/lib/api";
import { pushConfigured, sendPushToUsers } from "@/lib/push";
import { supabaseServer } from "@/lib/supabase/server";

/** Send a notification to the caller's own devices, to prove the pipe works. */
export async function POST() {
  if (!pushConfigured()) {
    return jsonError("Web Push is not configured on this deployment.", 503);
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in first.", 401);

  const result = await sendPushToUsers([user.id], {
    title: "ClubSync notifications are on",
    body: "This is what a meeting alert will look like on this device.",
    url: "/notifications",
    tag: "clubsync-test",
    kind: "system",
  });

  if (result.attempted === 0) {
    return jsonError("No devices are registered for push on this account yet.", 404);
  }
  if (result.delivered === 0) {
    return jsonError(
      `The push service rejected all ${result.attempted} attempt(s). ${
        result.removed > 0 ? "Expired subscriptions were removed — try enabling again." : ""
      }`.trim(),
      502,
    );
  }

  return jsonOk({ ...result });
}
