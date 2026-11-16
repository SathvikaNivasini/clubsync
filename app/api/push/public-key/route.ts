import { jsonOk } from "@/lib/api";
import { pushConfigured, vapidPublicKey } from "@/lib/push";

/**
 * The browser needs the VAPID public key to create a subscription.
 * This key is public by design; the private half never leaves the server.
 */
export async function GET() {
  const configured = pushConfigured();
  return jsonOk({
    configured,
    publicKey: configured ? vapidPublicKey() : null,
    reason: configured ? null : "Web Push is not configured on this deployment (no VAPID keys).",
  });
}
