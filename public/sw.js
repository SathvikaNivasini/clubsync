/* ClubSync service worker — Web Push receipt and notification clicks.
 * Deliberately does not cache application routes: availability and meeting
 * data must never be served stale from a cache.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "ClubSync", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "ClubSync";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: payload.tag || "clubsync",
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/notifications", kind: payload.kind || "system" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

/* If the push service rotates a subscription, tell the server about the new one. */
self.addEventListener("pushsubscriptionchange", (event) => {
  const newSubscription = event.newSubscription;
  if (!newSubscription) return;
  event.waitUntil(
    fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSubscription.toJSON()),
    }).catch(() => undefined),
  );
});
