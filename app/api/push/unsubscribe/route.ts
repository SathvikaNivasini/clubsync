import { asString, jsonError, jsonOk, readJson } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";

interface Body {
  endpoint?: unknown;
  all?: unknown;
}

export async function POST(request: Request) {
  const body = await readJson<Body>(request);
  const endpoint = asString(body?.endpoint, 1000);
  const all = body?.all === true;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in first.", 401);

  let query = supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (!all) {
    if (!endpoint) return jsonError("No subscription endpoint given.");
    query = query.eq("endpoint", endpoint);
  }

  const { error } = await query;
  if (error) return jsonError("Could not remove the subscription.", 500);

  return jsonOk({ unsubscribed: true });
}
