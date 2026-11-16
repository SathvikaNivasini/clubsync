"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { IconCheck, IconClock, IconPlus, IconTrash } from "@/components/ui/icons";
import { DAYS, PERIODS, type PeriodKey } from "@/lib/constants";
import { formatRelative, formatTimeRange } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";

export interface EditorSlot {
  day_of_week: number;
  period: PeriodKey;
}

export interface EditorWindow {
  day_of_week: number;
  starts_at: string;
  ends_at: string;
}

interface Props {
  clubId: string;
  clubName: string;
  initialSlots: EditorSlot[];
  initialWindows: EditorWindow[];
  lastUpdated: string | null;
}

const key = (day: number, period: string) => `${day}:${period}`;

function sortWindows(windows: EditorWindow[]): EditorWindow[] {
  return [...windows].sort(
    (a, b) => a.day_of_week - b.day_of_week || a.starts_at.localeCompare(b.starts_at),
  );
}

export function AvailabilityEditor({
  clubId,
  clubName,
  initialSlots,
  initialWindows,
  lastUpdated,
}: Props) {
  const router = useRouter();

  const initialKeys = useMemo(
    () => new Set(initialSlots.map((s) => key(s.day_of_week, s.period))),
    [initialSlots],
  );

  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialKeys));
  const [windows, setWindows] = useState<EditorWindow[]>(() =>
    sortWindows(initialWindows.map((w) => ({ ...w, starts_at: w.starts_at.slice(0, 5), ends_at: w.ends_at.slice(0, 5) }))),
  );
  const [savedAt, setSavedAt] = useState<string | null>(lastUpdated);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // The parent renders this with key={clubId}, so switching club remounts the
  // editor and the initialisers above run again — no reset effect needed.
  const dragging = useRef(false);
  const dragTurnsOn = useRef(true);

  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const dirty = useMemo(() => {
    const slotsChanged =
      selected.size !== initialKeys.size || [...selected].some((k) => !initialKeys.has(k));
    const initialWindowKeys = sortWindows(initialWindows)
      .map((w) => `${w.day_of_week}:${w.starts_at.slice(0, 5)}:${w.ends_at.slice(0, 5)}`)
      .join("|");
    const currentWindowKeys = sortWindows(windows)
      .map((w) => `${w.day_of_week}:${w.starts_at}:${w.ends_at}`)
      .join("|");
    return slotsChanged || initialWindowKeys !== currentWindowKeys;
  }, [selected, initialKeys, windows, initialWindows]);

  const apply = useCallback((day: number, period: string, turnOn: boolean) => {
    setStatus("idle");
    setSelected((prev) => {
      const next = new Set(prev);
      const k = key(day, period);
      if (turnOn) next.add(k);
      else next.delete(k);
      return next;
    });
  }, []);

  function onCellDown(day: number, period: string) {
    const turnOn = !selected.has(key(day, period));
    dragTurnsOn.current = turnOn;
    dragging.current = true;
    apply(day, period, turnOn);
  }

  function onCellEnter(day: number, period: string) {
    if (!dragging.current) return;
    apply(day, period, dragTurnsOn.current);
  }

  function toggleDay(day: number) {
    const allOn = PERIODS.every((p) => selected.has(key(day, p.key)));
    setStatus("idle");
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of PERIODS) {
        if (allOn) next.delete(key(day, p.key));
        else next.add(key(day, p.key));
      }
      return next;
    });
  }

  function togglePeriod(period: PeriodKey) {
    const allOn = DAYS.every((d) => selected.has(key(d.index, period)));
    setStatus("idle");
    setSelected((prev) => {
      const next = new Set(prev);
      for (const d of DAYS) {
        if (allOn) next.delete(key(d.index, period));
        else next.add(key(d.index, period));
      }
      return next;
    });
  }

  function addWindow() {
    setStatus("idle");
    setWindows((prev) => [...prev, { day_of_week: 3, starts_at: "15:30", ends_at: "17:00" }]);
  }

  function updateWindow(index: number, patch: Partial<EditorWindow>) {
    setStatus("idle");
    setWindows((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  function removeWindow(index: number) {
    setStatus("idle");
    setWindows((prev) => prev.filter((_, i) => i !== index));
  }

  const invalidWindows = windows.filter((w) => w.ends_at <= w.starts_at);

  async function save(clearEverything = false) {
    if (invalidWindows.length > 0 && !clearEverything) {
      setStatus("error");
      setError("Every custom time range needs an end time later than its start time.");
      return;
    }

    setStatus("saving");
    setError(null);

    const slots = clearEverything
      ? []
      : [...selected].map((k) => {
          const [day, period] = k.split(":");
          return { day: Number(day), period };
        });
    const customWindows = clearEverything
      ? []
      : windows.map((w) => ({ day: w.day_of_week, start: w.starts_at, end: w.ends_at }));

    const { data, error: rpcError } = await supabaseBrowser().rpc("replace_availability", {
      p_club: clubId,
      p_slots: slots,
      p_windows: customWindows,
    });

    if (rpcError) {
      setStatus("error");
      setError(
        rpcError.message.includes("clubsync: ")
          ? rpcError.message.replace(/^.*clubsync: /, "")
          : "Could not save your availability. Check your connection and try again.",
      );
      return;
    }

    if (clearEverything) {
      setSelected(new Set());
      setWindows([]);
    }
    setSavedAt(typeof data === "string" ? data : new Date().toISOString());
    setStatus("saved");
    router.refresh();
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-5">
      {/* Status strip */}
      <div className="cs-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span className="flex items-baseline gap-1.5">
            <span className="cs-numeric text-xl font-bold text-primary">{selectedCount}</span>
            <span className="text-sm text-muted">
              {selectedCount === 1 ? "slot selected" : "slots selected"}
            </span>
          </span>
          {windows.length > 0 ? (
            <span className="flex items-baseline gap-1.5">
              <span className="cs-numeric text-xl font-bold text-accent">{windows.length}</span>
              <span className="text-sm text-muted">
                custom {windows.length === 1 ? "range" : "ranges"}
              </span>
            </span>
          ) : null}
          <span className="text-sm text-muted">
            Last saved{" "}
            <strong className="font-semibold text-ink">{formatRelative(savedAt)}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="cs-pill border-[#f2ae5259] bg-accent-soft text-accent">
              Unsaved changes
            </span>
          ) : status === "saved" ? (
            <span className="cs-pill border-[#4ed2a659] bg-[#4ed2a614] text-success">
              <IconCheck size={13} /> Saved
            </span>
          ) : null}
        </div>
      </div>

      {status === "error" && error ? <Alert tone="danger" title="Not saved">{error}</Alert> : null}

      {/* The grid */}
      <div className="cs-card p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-ink">
            When can you make it to {clubName}?
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Tap any square, or press and drag to paint several at once. Tap a day or a period
            label to fill that whole row or column. Pick as many as you like — more options make
            it easier for your leader to find a time that works.
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[23rem] select-none">
            {/* Day headers */}
            <div className="mb-1.5 grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] gap-1.5">
              <span />
              {DAYS.map((day) => (
                <button
                  key={day.index}
                  type="button"
                  onClick={() => toggleDay(day.index)}
                  title={`Select or clear all of ${day.long}`}
                  className="rounded-md py-1 text-center text-[0.6875rem] font-bold text-muted transition-colors hover:bg-surface-hover hover:text-ink"
                >
                  <span className="hidden sm:inline">{day.short}</span>
                  <span className="sm:hidden">{day.initial}</span>
                </button>
              ))}
            </div>

            {PERIODS.map((period) => (
              <div
                key={period.key}
                className="mb-1.5 grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] items-stretch gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => togglePeriod(period.key)}
                  title={`Select or clear every ${period.label} slot`}
                  className="flex flex-col items-start justify-center rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="text-[0.6875rem] font-bold leading-tight text-ink">
                    <span className="hidden sm:inline">{period.label}</span>
                    <span className="sm:hidden">{period.short}</span>
                  </span>
                  <span className="hidden text-[0.625rem] text-muted-dim sm:block">
                    {formatTimeRange(period.typicalStart, period.typicalEnd)}
                  </span>
                </button>

                {DAYS.map((day) => {
                  const isOn = selected.has(key(day.index, period.key));
                  return (
                    <button
                      key={`${day.index}-${period.key}`}
                      type="button"
                      aria-pressed={isOn}
                      aria-label={`${day.long}, ${period.label}${isOn ? " — selected" : ""}`}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        onCellDown(day.index, period.key);
                      }}
                      onPointerEnter={() => onCellEnter(day.index, period.key)}
                      className={`flex h-12 items-center justify-center rounded-lg border transition-all duration-150 sm:h-[3.25rem] ${
                        isOn
                          ? "border-primary bg-primary text-[#06201c] shadow-glow"
                          : "border-line bg-canvas-deep text-transparent hover:border-line-strong hover:bg-surface-hover"
                      }`}
                    >
                      <IconCheck size={17} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom ranges */}
      <div className="cs-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <IconClock size={15} className="text-accent" />
              Exact time ranges
              <span className="cs-pill">Optional</span>
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
              If a period is too blunt — say you can only stay until 4:15 — add the exact window.
              Leaders see these as aggregate counts when they pick a start and end time.
            </p>
          </div>
          <button type="button" onClick={addWindow} className="cs-btn cs-btn-ghost shrink-0 text-sm">
            <IconPlus size={15} />
            Add a range
          </button>
        </div>

        {windows.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {windows.map((w, index) => {
              const invalid = w.ends_at <= w.starts_at;
              return (
                <li
                  key={index}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas-deep p-2.5"
                >
                  <select
                    value={w.day_of_week}
                    onChange={(e) => updateWindow(index, { day_of_week: Number(e.target.value) })}
                    aria-label="Day"
                    className="cs-input w-auto flex-1 min-w-[7.5rem] py-1.5 text-sm"
                  >
                    {DAYS.map((d) => (
                      <option key={d.index} value={d.index}>
                        {d.long}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={w.starts_at}
                    onChange={(e) => updateWindow(index, { starts_at: e.target.value })}
                    aria-label="Start time"
                    aria-invalid={invalid}
                    className="cs-input w-auto py-1.5 text-sm"
                  />
                  <span className="text-xs text-muted">to</span>
                  <input
                    type="time"
                    value={w.ends_at}
                    onChange={(e) => updateWindow(index, { ends_at: e.target.value })}
                    aria-label="End time"
                    aria-invalid={invalid}
                    className="cs-input w-auto py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeWindow(index)}
                    aria-label="Remove this time range"
                    className="ml-auto rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <IconTrash size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {invalidWindows.length > 0 ? (
          <p className="mt-3 text-xs font-medium text-danger">
            End times have to be later than start times.
          </p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="sticky bottom-20 z-20 lg:bottom-4">
        <div className="cs-card flex flex-wrap items-center justify-between gap-3 p-3 shadow-lifted">
          <button
            type="button"
            onClick={() => save(true)}
            disabled={status === "saving" || (selectedCount === 0 && windows.length === 0)}
            className="cs-btn cs-btn-danger text-sm"
          >
            Clear my availability
          </button>
          <button
            type="button"
            onClick={() => save(false)}
            disabled={status === "saving" || !dirty || invalidWindows.length > 0}
            className="cs-btn cs-btn-primary"
          >
            {status === "saving" ? "Saving…" : dirty ? "Save availability" : "Everything is saved"}
          </button>
        </div>
      </div>
    </div>
  );
}
