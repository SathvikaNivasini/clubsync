"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { IconBell, IconCheck } from "@/components/ui/icons";

type Support =
  | { kind: "checking" }
  | { kind: "unsupported"; reason: string }
  | { kind: "unconfigured"; reason: string }
  | { kind: "ready"; permission: NotificationPermission; subscribed: boolean };

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Push opt-in.
 *
 * This component refuses to overstate what it can do. It reports, separately:
 * whether the browser supports Web Push at all, whether this deployment has
 * VAPID keys, and whether permission has been granted, denied or not yet asked.
 * If push cannot work, it says so and points at the in-app notification centre.
 */
export function PushToggle() {
  const [support, setSupport] = useState<Support>({ kind: "checking" });
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Capability probe. Pure: it returns what it found rather than writing state,
   * so the effect below never calls setState synchronously during render.
   */
  const computeSupport = useCallback(async (): Promise<{
    support: Support;
    vapidKey: string | null;
  }> => {
    if (typeof window === "undefined") {
      return { support: { kind: "checking" }, vapidKey: null };
    }

    if (!("serviceWorker" in navigator)) {
      return {
        support: { kind: "unsupported", reason: "This browser has no service worker support." },
        vapidKey: null,
      };
    }
    if (!("PushManager" in window) || !("Notification" in window)) {
      return {
        support: {
          kind: "unsupported",
          reason:
            "This browser does not support Web Push. On iPhone and iPad, push only works once the site is added to the Home Screen.",
        },
        vapidKey: null,
      };
    }

    let key: string;
    try {
      const response = await fetch("/api/push/public-key");
      const payload = (await response.json()) as {
        configured?: boolean;
        publicKey?: string | null;
        reason?: string | null;
      };
      if (!payload.configured || !payload.publicKey) {
        return {
          support: {
            kind: "unconfigured",
            reason: payload.reason ?? "Web Push is not configured on this deployment.",
          },
          vapidKey: null,
        };
      }
      key = payload.publicKey;
    } catch {
      return {
        support: {
          kind: "unconfigured",
          reason: "Could not reach the server to check push configuration.",
        },
        vapidKey: null,
      };
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const existing = await registration.pushManager.getSubscription();
      return {
        support: {
          kind: "ready",
          permission: Notification.permission,
          subscribed: Boolean(existing),
        },
        vapidKey: key,
      };
    } catch {
      return {
        support: { kind: "unsupported", reason: "The service worker could not be registered." },
        vapidKey: key,
      };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await computeSupport();
      if (cancelled) return;
      setVapidKey(result.vapidKey);
      setSupport(result.support);
    })();
    return () => {
      cancelled = true;
    };
  }, [computeSupport]);

  async function enable() {
    if (!vapidKey) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSupport((prev) => (prev.kind === "ready" ? { ...prev, permission } : prev));
        setError(
          permission === "denied"
            ? "You blocked notifications for this site. Browsers only let you undo that from the site settings in your address bar."
            : "Notification permission was dismissed, so nothing was enabled.",
        );
        setBusy(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "The subscription could not be saved on the server.");
        setBusy(false);
        return;
      }

      setSupport({ kind: "ready", permission: "granted", subscribed: true });
      setMessage("Notifications are on for this device.");
    } catch (err) {
      setError(err instanceof Error ? `Could not enable notifications: ${err.message}` : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setSupport((prev) => (prev.kind === "ready" ? { ...prev, subscribed: false } : prev));
      setMessage("Notifications are off for this device. The notification centre still works.");
    } catch {
      setError("Could not turn notifications off cleanly. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/push/test", { method: "POST" });
    const payload = (await response.json()) as { ok?: boolean; error?: string; delivered?: number };
    setBusy(false);
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "The test notification could not be sent.");
      return;
    }
    setMessage(`Test notification sent to ${payload.delivered} device(s).`);
  }

  return (
    <div className="cs-card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <IconBell size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-ink">Push notifications</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Get told on this device when a meeting is scheduled, moved or cancelled. ClubSync asks
            your browser for permission — no email address or phone number is involved.
          </p>
        </div>
      </div>

      {support.kind === "checking" ? (
        <p className="text-sm text-muted">Checking what this device supports…</p>
      ) : null}

      {support.kind === "unsupported" ? (
        <Alert tone="warning" title="Push is not available on this device">
          {support.reason} Your notification centre inside ClubSync still records everything.
        </Alert>
      ) : null}

      {support.kind === "unconfigured" ? (
        <Alert tone="warning" title="Push is not set up on this deployment">
          {support.reason} Until VAPID keys are configured, nothing can be delivered to a device —
          the in-app notification centre is the full record.
        </Alert>
      ) : null}

      {support.kind === "ready" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`cs-pill ${
                support.subscribed
                  ? "border-[#4ed2a659] bg-[#4ed2a614] text-success"
                  : support.permission === "denied"
                    ? "border-[#f2635c59] bg-danger-soft text-danger"
                    : ""
              }`}
            >
              {support.subscribed ? <IconCheck size={13} /> : null}
              {support.subscribed
                ? "On for this device"
                : support.permission === "denied"
                  ? "Blocked in browser settings"
                  : "Off"}
            </span>
            <span className="text-xs text-muted">
              Browser permission: <strong className="text-ink">{support.permission}</strong>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {support.subscribed ? (
              <>
                <button onClick={disable} disabled={busy} className="cs-btn cs-btn-ghost text-sm">
                  Turn off on this device
                </button>
                <button onClick={sendTest} disabled={busy} className="cs-btn cs-btn-ghost text-sm">
                  Send a test notification
                </button>
              </>
            ) : (
              <button
                onClick={enable}
                disabled={busy || support.permission === "denied"}
                className="cs-btn cs-btn-primary text-sm"
              >
                {busy ? "Working…" : "Enable notifications"}
              </button>
            )}
          </div>
        </>
      ) : null}

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
