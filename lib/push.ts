import "server-only";

import webpush, { type PushSubscription, type WebPushError } from "web-push";

import { supabaseAdmin } from "./supabase/admin";

/**
 * Web Push delivery.
 *
 * Honesty rules baked in here:
 *   * If VAPID keys are absent, `pushConfigured()` is false and the UI says
 *     push is unavailable rather than pretending it works.
 *   * Delivery failures are reported, not swallowed. A 404/410 from the push
 *     service means the subscription is dead, so we delete it.
 *   * Every push is mirrored by a row in `notifications`, so the in-app
 *     notification centre is correct even when push is blocked or denied.
 */

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  kind?: string;
}

export interface PushResult {
  attempted: number;
  delivered: number;
  removed: number;
  failed: number;
}

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@clubsync.invalid";

  if (!publicKey || !privateKey) {
    configured = false;
    return configured;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

export function vapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

/**
 * Send a payload to every registered device of the given users.
 * Uses the service role because one user's action (a leader publishing a
 * meeting) must reach other users' subscriptions.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<PushResult> {
  const empty: PushResult = { attempted: 0, delivered: 0, removed: 0, failed: 0 };
  if (!pushConfigured() || userIds.length === 0) return empty;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .in("user_id", userIds);

  if (error || !data || data.length === 0) return empty;

  const rows = data as SubscriptionRow[];
  const body = JSON.stringify(payload);
  const deadIds: string[] = [];
  let delivered = 0;
  let failed = 0;

  await Promise.all(
    rows.map(async (row) => {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth_key },
      };
      try {
        await webpush.sendNotification(subscription, body, { TTL: 60 * 60 * 24 });
        delivered += 1;
      } catch (err) {
        const status = (err as WebPushError)?.statusCode;
        if (status === 404 || status === 410) {
          deadIds.push(row.id);
        } else {
          failed += 1;
        }
      }
    }),
  );

  if (deadIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", deadIds);
  }

  if (delivered > 0) {
    await admin
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .in(
        "id",
        rows.filter((r) => !deadIds.includes(r.id)).map((r) => r.id),
      );
  }

  return { attempted: rows.length, delivered, removed: deadIds.length, failed };
}

/** Every member of a club, for meeting fan-out. Service role: leaders may not read this. */
export async function clubMemberUserIds(clubId: string): Promise<string[]> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("club_memberships")
    .select("member_id, members!inner(notifications_enabled)")
    .eq("club_id", clubId);

  if (error || !data) return [];
  return (data as unknown as Array<{ member_id: string; members: { notifications_enabled: boolean } }>)
    .filter((row) => row.members?.notifications_enabled !== false)
    .map((row) => row.member_id);
}
