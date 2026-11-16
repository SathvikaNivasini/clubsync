"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { IconUsers } from "@/components/ui/icons";
import { PERIODS, type PeriodKey } from "@/lib/constants";
import { formatDate, mondayIndex, parseDateOnly, toDateOnly } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Meeting, SlotEstimate } from "@/lib/types";

interface Props {
  clubId: string;
  clubName: string;
  /** Present when editing an existing meeting. */
  meeting?: Meeting;
  defaults?: {
    date?: string;
    period?: string;
    start?: string;
    end?: string;
  };
}

export function MeetingForm({ clubId, clubName, meeting, defaults }: Props) {
  const router = useRouter();
  const editing = Boolean(meeting);

  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [location, setLocation] = useState(meeting?.location ?? "");
  const [date, setDate] = useState(
    meeting?.meeting_date ?? defaults?.date ?? toDateOnly(new Date()),
  );
  const [period, setPeriod] = useState<PeriodKey | "">(
    (meeting?.period_hint as PeriodKey) ?? (defaults?.period as PeriodKey) ?? "after_school",
  );
  const [startsAt, setStartsAt] = useState(
    meeting?.starts_at?.slice(0, 5) ?? defaults?.start ?? "15:15",
  );
  const [endsAt, setEndsAt] = useState(meeting?.ends_at?.slice(0, 5) ?? defaults?.end ?? "17:00");

  const [estimate, setEstimate] = useState<SlotEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dayIndex = useMemo(() => (date ? mondayIndex(parseDateOnly(date)) : null), [date]);

  /** Snap the times to a period's usual window when the leader picks one. */
  function choosePeriod(next: PeriodKey | "") {
    setPeriod(next);
    const match = PERIODS.find((p) => p.key === next);
    if (match) {
      setStartsAt(match.typicalStart);
      setEndsAt(match.typicalEnd);
    }
  }

  const loadEstimate = useCallback(async () => {
    if (!date || !startsAt || !endsAt || endsAt <= startsAt) {
      setEstimate(null);
      return;
    }
    setEstimateLoading(true);
    const { data, error: rpcError } = await supabaseBrowser().rpc("club_slot_estimate", {
      p_club: clubId,
      p_date: date,
      p_period: period || null,
      p_starts: startsAt,
      p_ends: endsAt,
    });
    setEstimateLoading(false);
    if (rpcError) {
      setEstimate(null);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setEstimate((row as SlotEstimate) ?? null);
  }, [clubId, date, period, startsAt, endsAt]);

  useEffect(() => {
    const timer = setTimeout(() => void loadEstimate(), 220);
    return () => clearTimeout(timer);
  }, [loadEstimate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (title.trim().length < 2) {
      setError("Give the meeting a title.");
      return;
    }
    if (endsAt <= startsAt) {
      setError("The end time has to be after the start time.");
      return;
    }

    setBusy(true);
    const body = {
      clubId,
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      date,
      startsAt,
      endsAt,
      periodHint: period,
    };

    const response = await fetch(editing ? `/api/meetings/${meeting!.id}` : "/api/meetings", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    setBusy(false);

    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Could not save the meeting.");
      return;
    }

    router.push("/leader/meetings");
    router.refresh();
  }

  const pastDate = date < toDateOnly(new Date());

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="cs-card space-y-4 p-5">
        <div>
          <label htmlFor="m-title" className="cs-label">Meeting title</label>
          <input
            id="m-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            placeholder="Competition prep"
            className="cs-input"
          />
        </div>

        <div>
          <label htmlFor="m-description" className="cs-label">
            Description <span className="font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            id="m-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What members should bring or prepare."
            className="cs-input resize-y"
          />
        </div>

        <div>
          <label htmlFor="m-location" className="cs-label">
            Location <span className="font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <input
            id="m-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={160}
            placeholder="Room 214"
            className="cs-input"
          />
        </div>
      </div>

      <div className="cs-card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-bold text-ink">When</h2>
          <p className="mt-1 text-xs text-muted">
            Picking a period snaps the times to that period&apos;s usual window — you can still
            adjust them.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="m-date" className="cs-label">Date</label>
            <input
              id="m-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="cs-input"
            />
            {dayIndex !== null && date ? (
              <p className="mt-1.5 text-xs text-muted">{formatDate(date, "long")}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="m-period" className="cs-label">Time period</label>
            <select
              id="m-period"
              value={period}
              onChange={(e) => choosePeriod(e.target.value as PeriodKey | "")}
              className="cs-input"
            >
              <option value="">No specific period</option>
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="m-start" className="cs-label">Starts</label>
            <input
              id="m-start"
              type="time"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              className="cs-input"
            />
          </div>

          <div>
            <label htmlFor="m-end" className="cs-label">Ends</label>
            <input
              id="m-end"
              type="time"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
              aria-invalid={endsAt <= startsAt}
              className="cs-input"
            />
          </div>
        </div>

        {pastDate ? (
          <Alert tone="warning" title="That date is in the past">
            You can still publish it, but members will see it as a past meeting.
          </Alert>
        ) : null}
      </div>

      {/* Live availability estimate */}
      <div className="cs-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <IconUsers size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-ink">Who said they are free then</h2>

            {estimateLoading ? (
              <p className="mt-2 text-sm text-muted">Checking availability…</p>
            ) : estimate ? (
              <>
                <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="cs-numeric text-3xl font-bold leading-none text-primary">
                    {estimate.combined_members}
                  </span>
                  <span className="text-sm text-muted">of {estimate.total_members} members</span>
                  <span className="cs-pill border-[#35c6b159] bg-primary-soft text-primary">
                    {estimate.pct}%
                  </span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {estimate.period_members} from the selected period
                  {estimate.window_members > 0
                    ? `, plus ${estimate.window_members} whose exact time range overlaps these hours`
                    : ""}
                  . Counted once each.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Pick a date and a valid time range to see the estimate.
              </p>
            )}

            <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
              <strong className="text-ink">This is an availability estimate, not an RSVP.</strong>{" "}
              It counts members who marked themselves generally free at this day and time. Nobody
              has confirmed attendance, and members are not asked to.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="cs-btn cs-btn-primary">
          {busy
            ? editing
              ? "Saving…"
              : "Publishing…"
            : editing
              ? "Save changes"
              : `Publish to ${clubName}`}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="cs-btn cs-btn-ghost"
        >
          Cancel
        </button>
        <p className="text-xs text-muted">
          {editing
            ? "Members are notified if the date, time, place or title changes."
            : "Every member of the club is notified as soon as you publish."}
        </p>
      </div>
    </form>
  );
}
