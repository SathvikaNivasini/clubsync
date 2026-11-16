"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { IconBell, IconCheck, IconTrash } from "@/components/ui/icons";
import { formatRelative } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { AppNotification, NotificationKind } from "@/lib/types";

const KIND_STYLES: Record<NotificationKind, { label: string; className: string }> = {
  meeting_scheduled: { label: "New meeting", className: "border-[#35c6b159] bg-primary-soft text-primary" },
  meeting_updated: { label: "Rescheduled", className: "border-[#f2ae5259] bg-accent-soft text-accent" },
  meeting_cancelled: { label: "Cancelled", className: "border-[#f2635c59] bg-danger-soft text-danger" },
  meeting_reminder: { label: "Reminder", className: "border-[#6aa8f259] bg-[#6aa8f214] text-info" },
  club_joined: { label: "Club", className: "" },
  system: { label: "ClubSync", className: "" },
};

export function NotificationList({ initial }: { initial: AppNotification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const unread = items.filter((n) => !n.read_at);

  async function markAllRead() {
    if (unread.length === 0) return;
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabaseBrowser()
      .from("notifications")
      .update({ read_at: now })
      .is("read_at", null);
    setBusy(false);
    if (!error) {
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
      startTransition(() => router.refresh());
    }
  }

  async function markOneRead(id: string) {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
    await supabaseBrowser().from("notifications").update({ read_at: now }).eq("id", id);
    startTransition(() => router.refresh());
  }

  async function clearRead() {
    const readIds = items.filter((n) => n.read_at).map((n) => n.id);
    if (readIds.length === 0) return;
    setBusy(true);
    const { error } = await supabaseBrowser().from("notifications").delete().in("id", readIds);
    setBusy(false);
    if (!error) {
      setItems((prev) => prev.filter((n) => !n.read_at));
      startTransition(() => router.refresh());
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<IconBell size={20} />}
        title="No notifications yet"
        description="When a leader schedules, moves or cancels a meeting in one of your clubs, it lands here — whether or not push notifications are switched on."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {unread.length > 0 ? (
            <>
              <strong className="font-semibold text-ink">{unread.length}</strong> unread of{" "}
              {items.length}
            </>
          ) : (
            `${items.length} notification${items.length === 1 ? "" : "s"}, all read`
          )}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={markAllRead}
            disabled={busy || unread.length === 0}
            className="cs-btn cs-btn-ghost text-sm"
          >
            <IconCheck size={15} />
            Mark all read
          </button>
          <button
            type="button"
            onClick={clearRead}
            disabled={busy || items.every((n) => !n.read_at)}
            className="cs-btn cs-btn-ghost text-sm"
          >
            <IconTrash size={15} />
            Clear read
          </button>
        </div>
      </div>

      <ul className="space-y-2.5">
        {items.map((n) => {
          const style = KIND_STYLES[n.kind] ?? KIND_STYLES.system;
          const isUnread = !n.read_at;
          return (
            <li key={n.id}>
              <article
                className={`cs-card relative p-4 ${isUnread ? "border-line-strong" : "opacity-80"}`}
              >
                {isUnread ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 h-full w-[3px] rounded-l-[inherit] bg-primary"
                  />
                ) : null}
                <div className="flex flex-wrap items-start justify-between gap-3 pl-1.5">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`cs-pill ${style.className}`}>{style.label}</span>
                      <span className="text-xs text-muted">{formatRelative(n.created_at)}</span>
                      {isUnread ? (
                        <span className="sr-only">Unread</span>
                      ) : null}
                    </div>
                    <h3 className="text-sm font-bold text-ink">{n.title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{n.body}</p>
                  </div>
                  {isUnread ? (
                    <button
                      type="button"
                      onClick={() => markOneRead(n.id)}
                      className="shrink-0 rounded-md border border-line px-2 py-1 text-[0.6875rem] font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
