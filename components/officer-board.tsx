"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MonthGrid } from "@/components/calendar/month-grid";
import { Banner, Empty, H1 } from "@/components/ui/bits";
import { SlotPill } from "@/components/ui/slot-pill";
import { addDays, countdown, iso, isPast, pretty } from "@/lib/dates";
import { SLOTS, slotLabel } from "@/lib/slots";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Result {
  round_id: string; deadline: string; closed: boolean;
  option_id: string; slot_date: string; slot: string;
  votes: number; total_members: number;
}
interface Meeting { meeting_id: string; slot_date: string; slot: string; location: string | null }

const DEADLINES = [
  { label: "1 day", hours: 24 },
  { label: "2 days", hours: 48 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
];

export function OfficerBoard({ clubName, clubCode }: { clubName: string; clubCode: string }) {
  const [month, setMonth] = useState(() => new Date());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Result[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [hours, setHours] = useState(48);
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = useMemo(() => iso(new Date()), []);
  const to = useMemo(() => iso(addDays(new Date(), 120)), []);

  const fetchState = useCallback(async () => {
    const sb = supabaseBrowser();
    const [{ data: r }, { data: m }] = await Promise.all([
      sb.rpc("officer_results"),
      sb.rpc("my_meetings", { p_from: from, p_to: to }),
    ]);
    return { results: (r as Result[]) ?? [], meetings: (m as Meeting[]) ?? [] };
  }, [from, to]);

  const load = useCallback(async () => {
    const next = await fetchState();
    setResults(next.results);
    setMeetings(next.meetings);
  }, [fetchState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchState();
      if (cancelled) return;
      setResults(next.results);
      setMeetings(next.meetings);
    })();
    return () => { cancelled = true; };
  }, [fetchState]);

  const round = results[0];
  const maxVotes = Math.max(1, ...results.map((r) => r.votes));

  async function openRound() {
    if (picked.size === 0) return;
    setBusy(true);
    setError(null);
    const options = [...picked].map((k) => {
      const [date, slot] = k.split("|");
      return { date, slot };
    });
    const { error: e } = await supabaseBrowser().rpc("officer_open_round", {
      p_deadline: new Date(Date.now() + hours * 3600_000).toISOString(),
      p_options: options,
    });
    setBusy(false);
    if (e) { setError(e.message.replace(/^.*clubsync: /, "")); return; }
    setPicked(new Set());
    await load();
  }

  async function finalize(optionId: string) {
    setBusy(true);
    setError(null);
    const { error: e } = await supabaseBrowser().rpc("officer_finalize", {
      p_option: optionId,
      p_location: location || null,
    });
    setBusy(false);
    if (e) { setError(e.message.replace(/^.*clubsync: /, "")); return; }
    setLocation("");
    await load();
  }

  async function cancel(id: string) {
    setBusy(true);
    await supabaseBrowser().rpc("officer_cancel_meeting", { p_meeting: id });
    setBusy(false);
    await load();
  }

  return (
    <>
      <H1 sub={`${clubName} · code ${clubCode}`}>Set a meeting</H1>
      {error ? <Banner tone="bad">{error}</Banner> : null}

      {meetings.length > 0 ? (
        <section className="space-y-2">
          {meetings.map((m) => (
            <div key={m.meeting_id} className="card flex items-center justify-between gap-3 border-[#bfe8e0] bg-primary-soft px-4 py-3">
              <div>
                <p className="font-bold text-primary-dark">{pretty(m.slot_date)} · {slotLabel(m.slot)}</p>
                <p className="text-sm text-muted">{m.location ?? "No room set"}</p>
              </div>
              <button onClick={() => cancel(m.meeting_id)} disabled={busy} className="btn btn-danger px-2.5 py-1 text-xs">
                Cancel
              </button>
            </div>
          ))}
        </section>
      ) : null}

      {round ? (
        <section className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Votes</h2>
            <span className={`chip ${round.closed ? "" : "border-[#bfe8e0] bg-primary-soft text-primary-dark"}`}>
              {round.closed ? "Closed" : countdown(round.deadline)}
            </span>
          </div>
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.option_id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{pretty(r.slot_date)} · {slotLabel(r.slot)}</span>
                  <span className="num text-muted">
                    <span className="font-bold text-ink">{r.votes}</span>/{r.total_members}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500"
                         style={{ width: `${(r.votes / maxVotes) * 100}%` }} />
                  </div>
                  <button onClick={() => finalize(r.option_id)} disabled={busy}
                          className="btn btn-primary px-2.5 py-1 text-xs">
                    Book
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <input value={location} onChange={(e) => setLocation(e.target.value)}
                 placeholder="Room (optional)" maxLength={80} className="field text-sm" aria-label="Room" />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold">
          Pick times <span className="font-normal text-muted">— tap days students can vote on</span>
        </h2>

        <MonthGrid
          month={month}
          onMonthChange={setMonth}
          renderDay={(date, inMonth, isToday) => {
            const past = isPast(date);
            return (
              <div className={`rounded-lg p-1 ${inMonth ? "" : "opacity-35"}`}>
                <div className={`mb-1 text-center text-[0.6875rem] font-bold ${isToday ? "text-primary" : "text-faint"}`}>
                  {Number(date.slice(8, 10))}
                </div>
                <div className="space-y-1">
                  {SLOTS.map((s) => {
                    const key = `${date}|${s.key}`;
                    return (
                      <SlotPill
                        key={s.key}
                        slot={s.key}
                        state={picked.has(key) ? "on" : "off"}
                        label={s.short}
                        disabled={past}
                        title={`${slotLabel(s.key)} on ${pretty(date)}`}
                        onClick={() =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key); else next.add(key);
                            return next;
                          })
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          }}
        />

        <div className="card space-y-3 p-4">
          <p className="text-sm font-semibold">Voting closes in</p>
          <div className="grid grid-cols-4 gap-1.5">
            {DEADLINES.map((d) => (
              <button key={d.hours} type="button" onClick={() => setHours(d.hours)}
                      aria-pressed={hours === d.hours}
                      className={`tile px-2 py-2 text-xs font-semibold ${
                        hours === d.hours ? "border-[#bfe8e0] bg-primary-soft text-primary-dark" : ""
                      }`}>
                {d.label}
              </button>
            ))}
          </div>
          <button onClick={openRound} disabled={busy || picked.size === 0} className="btn btn-primary w-full">
            {picked.size === 0 ? "Pick some times" : `Open vote · ${picked.size} time${picked.size > 1 ? "s" : ""}`}
          </button>
          {round && !round.closed ? (
            <p className="text-center text-xs text-muted">Opening a new vote closes the current one.</p>
          ) : null}
        </div>
      </section>

      {!round && meetings.length === 0 ? (
        <Empty icon="🗳️" title="No vote open yet" hint="Pick a few times above and open one." />
      ) : null}
    </>
  );
}
