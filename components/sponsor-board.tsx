"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MonthGrid } from "@/components/calendar/month-grid";
import { Banner, Empty, H1 } from "@/components/ui/bits";
import { SlotPill } from "@/components/ui/slot-pill";
import { addDays, gridStart, iso, isPast, pretty } from "@/lib/dates";
import { SLOTS, slotLabel } from "@/lib/slots";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Club { club_id: string; code: string; name: string }
interface SlotRow { slot_date: string; slot: string; booked_by: string | null; booked_club_code: string | null }
interface Meeting { meeting_id: string; club_name: string; club_code: string; slot_date: string; slot: string; location: string | null }

export function SponsorBoard({ clubs }: { clubs: Club[] }) {
  const [month, setMonth] = useState(() => new Date());
  const [rows, setRows] = useState<SlotRow[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const from = useMemo(() => iso(gridStart(month)), [month]);
  const to = useMemo(() => iso(addDays(gridStart(month), 41)), [month]);

  /** Pure fetch — returns data rather than writing state, so the effect below
   *  never calls setState during render. */
  const fetchState = useCallback(async () => {
    const sb = supabaseBrowser();
    const [{ data: slots }, { data: mtgs }] = await Promise.all([
      sb.rpc("sponsor_calendar", { p_from: from, p_to: to }),
      sb.rpc("my_meetings", { p_from: from, p_to: to }),
    ]);
    return { rows: (slots as SlotRow[]) ?? [], meetings: (mtgs as Meeting[]) ?? [] };
  }, [from, to]);

  const load = useCallback(async () => {
    const next = await fetchState();
    setRows(next.rows);
    setMeetings(next.meetings);
  }, [fetchState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchState();
      if (cancelled) return;
      setRows(next.rows);
      setMeetings(next.meetings);
    })();
    return () => { cancelled = true; };
  }, [fetchState]);

  const byKey = useMemo(() => {
    const m = new Map<string, SlotRow>();
    for (const r of rows) m.set(`${r.slot_date}:${r.slot}`, r);
    return m;
  }, [rows]);

  async function toggle(date: string, slot: string) {
    const key = `${date}:${slot}`;
    setPending(key);
    setError(null);
    const { error: rpcError } = await supabaseBrowser().rpc("sponsor_toggle_slot", {
      p_date: date,
      p_slot: slot,
    });
    setPending(null);
    if (rpcError) {
      setError(rpcError.message.replace(/^.*clubsync: /, ""));
      return;
    }
    await load();
  }

  const offeredCount = rows.length;

  return (
    <>
      <H1 sub="Tap a day to offer it. Officers can only pick from these.">When are you free?</H1>

      {clubs.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {clubs.map((c) => (
            <span key={c.club_id} className="chip">{c.name}</span>
          ))}
          <span className="chip border-[#f6ddb2] bg-accent-soft text-[#8a5a10]">
            shared — first to book wins
          </span>
        </div>
      ) : null}

      {error ? <Banner tone="bad">{error}</Banner> : null}

      <MonthGrid
        month={month}
        onMonthChange={setMonth}
        renderDay={(date, inMonth, isToday) => {
          const past = isPast(date);
          return (
            <div className={`rounded-lg p-1 ${inMonth ? "" : "opacity-35"}`}>
              <div
                className={`mb-1 text-center text-[0.6875rem] font-bold ${
                  isToday ? "text-primary" : "text-faint"
                }`}
              >
                {Number(date.slice(8, 10))}
              </div>
              <div className="space-y-1">
                {SLOTS.map((s) => {
                  const row = byKey.get(`${date}:${s.key}`);
                  const booked = Boolean(row?.booked_club_code);
                  return (
                    <SlotPill
                      key={s.key}
                      slot={s.key}
                      state={booked ? "locked" : row ? "on" : "off"}
                      label={booked ? row!.booked_club_code! : s.short}
                      disabled={past || pending === `${date}:${s.key}`}
                      title={
                        booked
                          ? `${row!.booked_by} booked ${slotLabel(s.key)}`
                          : `${slotLabel(s.key)} on ${pretty(date)}`
                      }
                      onClick={() => toggle(date, s.key)}
                    />
                  );
                })}
              </div>
            </div>
          );
        }}
      />

      <p className="text-center text-sm text-muted">
        <span className="num font-semibold text-ink">{offeredCount}</span> slots offered this month
      </p>

      <section className="space-y-2">
        <h2 className="text-sm font-bold">Booked</h2>
        {meetings.length === 0 ? (
          <Empty icon="🗓️" title="Nothing booked yet" hint="Officers book from the times you offer." />
        ) : (
          <ul className="space-y-2">
            {meetings.map((m) => (
              <li key={m.meeting_id} className="card flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold">{m.club_name}</p>
                  <p className="text-sm text-muted">
                    {pretty(m.slot_date)} · {slotLabel(m.slot)}
                    {m.location ? ` · ${m.location}` : ""}
                  </p>
                </div>
                <span className="chip font-mono">{m.club_code}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
