"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { ClubDot } from "@/components/ui/club-dot";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Member, MemberClubView } from "@/lib/types";

export function MemberSettings({
  member,
  clubs,
}: {
  member: Member;
  clubs: MemberClubView[];
}) {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(member.notifications_enabled);
  const [leadMinutes, setLeadMinutes] = useState(member.reminder_lead_minutes);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);

  async function savePreferences() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const { error: updateError } = await supabaseBrowser()
      .from("members")
      .update({ notifications_enabled: notificationsEnabled, reminder_lead_minutes: leadMinutes })
      .eq("id", member.id);
    setBusy(false);
    if (updateError) {
      setError("Could not save your preferences.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function leaveClub(clubId: string) {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabaseBrowser().rpc("leave_club", { p_club: clubId });
    setBusy(false);
    setLeaving(null);
    if (rpcError) {
      setError("Could not leave that club.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="cs-card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-bold text-ink">Notification preferences</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            These apply to every club. Turning notifications off stops reminders and push messages;
            the notification centre still records meeting changes.
          </p>
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {saved ? <Alert tone="success">Preferences saved.</Alert> : null}

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => {
              setNotificationsEnabled(e.target.checked);
              setSaved(false);
            }}
            className="mt-0.5 h-4 w-4 accent-[#35C6B1]"
          />
          <span className="text-sm text-ink">
            Send me meeting notifications
            <span className="mt-0.5 block text-xs text-muted">
              Uncheck to stop all reminders and push messages for every club.
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="lead" className="cs-label">Remind me before a meeting</label>
          <select
            id="lead"
            value={leadMinutes}
            onChange={(e) => {
              setLeadMinutes(Number(e.target.value));
              setSaved(false);
            }}
            className="cs-input max-w-xs"
          >
            <option value={15}>15 minutes before</option>
            <option value={30}>30 minutes before</option>
            <option value={60}>1 hour before</option>
            <option value={120}>2 hours before</option>
            <option value={720}>12 hours before</option>
            <option value={1440}>1 day before</option>
          </select>
          <p className="mt-1.5 text-xs text-muted">
            Reminders need a scheduled job on the server. If the deployment has not set one up, no
            reminder is sent — meeting-change notifications still work.
          </p>
        </div>

        <button onClick={savePreferences} disabled={busy} className="cs-btn cs-btn-primary">
          {busy ? "Saving…" : "Save preferences"}
        </button>
      </section>

      {clubs.length > 0 ? (
        <section className="cs-card space-y-3 p-5">
          <div>
            <h2 className="text-sm font-bold text-ink">Your clubs</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Leaving a club deletes your availability for it immediately and permanently.
            </p>
          </div>
          <ul className="space-y-2">
            {clubs.map((entry) => (
              <li
                key={entry.club.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas-deep p-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ClubDot color={entry.club.accent_color} size={8} />
                  <span className="truncate text-sm font-semibold text-ink">{entry.club.name}</span>
                  <span className="cs-pill shrink-0">Member #{entry.memberNumber}</span>
                </span>
                {leaving === entry.club.id ? (
                  <span className="flex items-center gap-2">
                    <button
                      onClick={() => leaveClub(entry.club.id)}
                      disabled={busy}
                      className="cs-btn cs-btn-danger px-2.5 py-1 text-xs"
                    >
                      Confirm leave
                    </button>
                    <button
                      onClick={() => setLeaving(null)}
                      className="cs-btn cs-btn-ghost px-2.5 py-1 text-xs"
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setLeaving(entry.club.id)}
                    className="cs-btn cs-btn-ghost px-2.5 py-1 text-xs"
                  >
                    Leave club
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
