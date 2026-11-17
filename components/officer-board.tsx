"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Banner, Empty, H1 } from "@/components/ui/bits";
import { SlotPill } from "@/components/ui/slot-pill";
import { addDays, countdown, iso, pretty } from "@/lib/dates";
import { SLOTS, slotLabel } from "@/lib/slots";
import { supabaseBrowser } from "@/lib/supabase/client";

interface OfficerSlot { slot_id: string; slot_date: string; slot: string; taken_by_club: string | null; taken_by_us: boolean }
interface Result {
  round_id: string; deadline: string; status: string; closed: boolean;
  option_id: string; slot_date: string; slot: string;
  votes: number; total_members: number; taken_by_club: string | null;
}
interface Meeting { meeting_id: string; club_name: string; slot_date: string; slot: string; location: string | null }

const DEADLINE_CHOICES = [
  { label: "1 day", hours: 24 },
  { label: "2 days", hours: 48 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
];

export function OfficerBoard({ clubName }: { clubName: string }) {
  const [slots, setSlots] = useState<OfficerSlot[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [hours, setHours] = useState(48);
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = useMemo(() => iso(new Date()), []);
  const to = useMemo(() => iso(addDays(new Date(), 60)), []);

  const fetchState = useCallback(async () => {
    const sb = supabaseBrowser();
    const [{ data: s }, { data: r }, { data: m }] = await Promise.all([
      sb.rpc("officer_slots", { p_from: from, p_to: to }),
      sb.rpc("officer_results"),
      sb.rpc("my_meetings", { p_from: from, p_to: to }),
    ]);
    return {
      slots: (s as OfficerSlot[]) ?? [],
      results: (r as Result[]) ?? [],
      meetings: (m as Meeting[]) ?? [],
    };
  }, [from, to]);

  const load = useCallback(async () => {
    const next = await fetchState();
    setSlots(next.slots);
    setResults(next.results);
    setMeetings(next.meetings);
  }, [fetchState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchState();
      if (cancelled) return;
      setSlots(next.slots);
      setResults(next.results);
      setMeetings(next.meetings);
    })();
    return () => { cancelled = true; };
  }, [fetchState]);

  const free = slots.filter((s) => !s.taken_by_club && !s.taken_by_us);
  const byDate = useMemo(() => {
    const m = new Map<string, OfficerSlot[]>();
    for (const s of slots) {
      const list = m.get(s.slot_date) ?? [];
      list.push(s);
      m.set(s.slot_date, list);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const round = results[0];
  const maxVotes = Math.max(1, ...results.map((r) => r.votes));

  async function openRound() {
    if (picked.size === 0) return;
    setBusy(true);
    setError(null);
    const deadline = new Date(Date.now() + hours * 3600_000).toISOString();
    const { error: e } = await supabaseBrowser().rpc("officer_open_round", {
      p_deadline: deadline,
      p_slot_ids: [...picked],
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
      <H1 sub={clubName}>Set a meeting</H1>
      {error ? <Banner tone="bad">{error}</Banner> : null}

      {/* booked meetings */}
      {meetings.length > 0 ? (
        <section className="space-y-2">
          {meetings.map((m) => (
            <div key={m.meeting_id} className="card flex items-center justify-between gap-3 border-[#bfe8e0] bg-primary-soft px-4 py-3">
              <div>
                <p className="font-bold text-primary-dark">
                  {pretty(m.slot_date)} · {slotLabel(m.slot)}
                </p>
                <p className="text-sm text-muted">{m.location ?? "No room set"}</p>
              </div>
              <button onClick={() => cancel(m.meeting_id)} disabled={busy} className="btn btn-danger px-2.5 py-1 text-xs">
                Cancel
              </button>
            </div>
          ))}
        </section>
      ) : null}

      {/* live results */}
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
                  <span className="font-semibold">
                    {pretty(r.slot_date)} · {slotLabel(r.slot)}
                  </span>
                  <span className="num text-muted">
                    <span className="font-bold text-ink">{r.votes}</span>/{r.total_members}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${(r.votes / maxVotes) * 100}%` }}
                    />
                  </div>
                  {r.taken_by_club ? (
                    <span className="chip text-[0.625rem]">taken by {r.taken_by_club}</span>
                  ) : (
                    <button
                      onClick={() => finalize(r.option_id)}
                      disabled={busy}
                      className="btn btn-primary px-2.5 py-1 text-xs"
                    >
                      Pick
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Room (optional)"
            maxLength={80}
            className="field text-sm"
            aria-label="Room"
          />
        </section>
      ) : null}

      {/* open a new vote */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold">
          Open a vote <span className="font-normal text-muted">— your sponsor&apos;s free times</span>
        </h2>

        {free.length === 0 ? (
          <Empty icon="⏳" title="No times offered" hint="Your sponsor hasn't marked any free days yet." />
        ) : (
          <>
            <div className="card divide-y divide-line p-0">
              {byDate.map(([date, list]) => (
                <div key={date} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-sm font-medium">{pretty(date)}</span>
                  <div className="flex gap-1.5">
                    {SLOTS.map((s) => {
                      const row = list.find((x) => x.slot === s.key);
                      if (!row) return <span key={s.key} className="w-20" />;
                      const taken = Boolean(row.taken_by_club) || row.taken_by_us;
                      return (
                        <div key={s.key} className="w-20">
                          <SlotPill
                            slot={s.key}
                            state={taken ? "locked" : picked.has(row.slot_id) ? "on" : "off"}
                            label={row.taken_by_club ?? (row.taken_by_us ? "Booked" : s.short)}
                            title={row.taken_by_club ? `${row.taken_by_club} booked this` : slotLabel(s.key)}
                            onClick={() =>
                              setPicked((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.slot_id)) next.delete(row.slot_id);
                                else next.add(row.slot_id);
                                return next;
                              })
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="card space-y-3 p-4">
              <p className="text-sm font-semibold">Voting closes in</p>
              <div className="grid grid-cols-4 gap-1.5">
                {DEADLINE_CHOICES.map((d) => (
                  <button
                    key={d.hours}
                    type="button"
                    onClick={() => setHours(d.hours)}
                    aria-pressed={hours === d.hours}
                    className={`tile px-2 py-2 text-xs font-semibold ${
                      hours === d.hours ? "bg-primary-soft text-primary-dark border-[#bfe8e0]" : ""
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <button onClick={openRound} disabled={busy || picked.size === 0} className="btn btn-primary w-full">
                {picked.size === 0 ? "Pick some times" : `Open vote · ${picked.size} time${picked.size > 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
