#!/usr/bin/env node
/**
 * Generate a VAPID key pair for Web Push.
 *
 *   node scripts/generate-vapid-keys.mjs
 *
 * The public key is safe to expose (the browser needs it). The private key
 * must stay on the server — never prefix it with NEXT_PUBLIC_.
 *
 * Changing these keys invalidates every existing push subscription, so
 * generate them once per deployment and keep them.
 */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Add these to .env.local (and to your hosting provider's environment):

NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:you@example.com

  * NEXT_PUBLIC_VAPID_PUBLIC_KEY is sent to browsers. That is by design.
  * VAPID_PRIVATE_KEY signs push messages. Keep it secret.
  * VAPID_SUBJECT must be a mailto: or https: URL that push services can use
    to contact whoever operates the deployment.
`);
