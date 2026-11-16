import { asString, friendlyDbError, jsonError, jsonOk, readJson } from "@/lib/api";
import { pushConfigured } from "@/lib/push";
import { supabaseServer } from "@/lib/supabase/server";

interface Body {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

/**
 * Coarse device label, so a member can tell their phone from their laptop in
 * settings. Deliberately not the full user-agent string — that is a
 * fingerprint we have no reason to retain.
 */
function deviceLabel(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const platform = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iOS"
      : /Macintosh/.test(userAgent)
        ? "Mac"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "device";
  return `${browser} on ${platform}`.slice(0, 40);
}

export async function POST(request: Request) {
  if (!pushConfigured()) {
    return jsonError("Web Push is not configured on this deployment.", 503);
  }

  const body = await readJson<Body>(request);
  const endpoint = asString(body?.endpoint, 1000);
  const p256dh = asString(body?.keys?.p256dh, 400);
  const auth = asString(body?.keys?.auth, 400);

  if (!endpoint || !p256dh || !auth) {
    return jsonError("That subscription is incomplete.");
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in first.", 401);

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth_key: auth,
        device_label: deviceLabel(request.headers.get("user-agent") ?? ""),
        failure_count: 0,
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    console.error("[clubsync] push subscribe failed:", error.message);
    return jsonError(friendlyDbError(error), 500);
  }

  return jsonOk({ subscribed: true });
}
