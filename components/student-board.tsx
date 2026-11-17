"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Banner, Empty, H1 } from "@/components/ui/bits";
import { SlotPill } from "@/components/ui/slot-pill";
import { addDays, countdown, iso, pretty } from "@/lib/dates";
import { slotLabel } from "@/lib/slots";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Ballot {
  club_id: string; club_name: string; club_code: string;
  round_id: string; deadline: string; closed: boolean;
  option_id: string; slot_date: string; slot: string; i_voted: boolean;
}
interface Meeting { meeting_id: string; club_name: string; club_code: string; slot_date: string; slot: string; location: string | null }

export function StudentBoard() {
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const from = useMemo(() => iso(new Date()), []);
  const to = useMemo(() => iso(addDays(new Date(), 90)), []);

  const fetchState = useCallback(async () => {
    const sb = supabaseBrowser();
    const [{ data: b }, { data: m }] = await Promise.all([
      sb.rpc("member_ballots"),
      sb.rpc("my_meetings", { p_from: from, p_to: to }),
    ]);
    return { ballots: (b as Ballot[]) ?? [], meetings: (m as Meeting[]) ?? [] };
  }, [from, to]);

  const load = useCallback(async () => {
    const next = await fetchState();
    setBallots(next.ballots);
    setMeetings(next.meetings);
  }, [fetchState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchState();
      if (cancelled) return;
      setBallots(next.ballots);
      setMeetings(next.meetings);
    })();
    return () => { cancelled = true; };
  }, [fetchState]);

  const grouped = useMemo(() => {
    const m = new Map<string, Ballot[]>();
    for (const b of ballots) {
      const list = m.get(b.round_id) ?? [];
      list.push(b);
      m.set(b.round_id, list);
    }
    return [...m.values()];
  }, [ballots]);

  async function vote(option: Ballot) {
    setPending(option.option_id);
    setError(null);
    const { error: e } = await supabaseBrowser().rpc("member_vote", {
      p_option: option.option_id,
      p_on: !option.i_voted,
    });
    setPending(null);
    if (e) { setError(e.message.replace(/^.*clubsync: /, "")); await load(); return; }
    setBallots((prev) =>
      prev.map((b) => (b.option_id === option.option_id ? { ...b, i_voted: !b.i_voted } : b)),
    );
  }

  return (
    <>
      <H1 sub="Tap every time that works for you.">Vote</H1>
      {error ? <Banner tone="bad">{error}</Banner> : null}

      {grouped.length === 0 ? (
        <Empty icon="🗳️" title="Nothing to vote on" hint="You'll see a vote here when an officer opens one." />
      ) : (
        grouped.map((options) => {
          const head = options[0];
          return (
            <section key={head.round_id} className="card space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{head.club_name}</p>
                <span className={`chip ${head.closed ? "" : "border-[#bfe8e0] bg-primary-soft text-primary-dark"}`}>
                  {head.closed ? "Closed" : countdown(head.deadline)}
                </span>
              </div>
              <ul className="space-y-1.5">
                {options.map((o) => (
                  <li key={o.option_id} className="flex items-center justify-between gap-3">
                    <span className="text-sm">
                      <span className="font-medium">{pretty(o.slot_date)}</span>
                      <span className="text-muted"> · {slotLabel(o.slot)}</span>
                    </span>
                    <div className="w-28">
                      <SlotPill
                        slot={o.slot}
                        state={o.i_voted ? "on" : "off"}
                        label={o.i_voted ? "✓ Works" : "I'm free"}
                        disabled={head.closed || pending === o.option_id}
                        onClick={() => vote(o)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold">Your meetings</h2>
        {meetings.length === 0 ? (
          <Empty icon="🗓️" title="None scheduled yet" />
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
