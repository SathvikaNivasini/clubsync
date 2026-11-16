import Link from "next/link";

import { DAYS } from "@/lib/constants";
import { formatTimeRange, nextDateForDay } from "@/lib/format";
import { IconArrowRight, IconSparkle } from "@/components/ui/icons";
import type { BestTime } from "@/lib/types";

function scheduleHref(slot: BestTime, clubId: string): string {
  const params = new URLSearchParams({
    club: clubId,
    date: nextDateForDay(slot.day_of_week),
    period: slot.period,
    start: slot.typical_start.slice(0, 5),
    end: slot.typical_end.slice(0, 5),
  });
  return `/leader/meetings/new?${params.toString()}`;
}

/**
 * The recommendation. It ranks slots and offers them — it never schedules
 * anything. Choosing a slot only pre-fills the scheduling form, which the
 * leader still has to review and publish.
 */
export function BestTimePanel({ slots, clubId }: { slots: BestTime[]; clubId: string }) {
  if (slots.length === 0) {
    return (
      <section className="cs-card p-5">
        <h3 className="text-sm font-bold text-ink">Best meeting time</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Once members start submitting availability, ClubSync will rank every day-and-period
          combination here and show you which one reaches the most people.
        </p>
      </section>
    );
  }

  const [top, ...alternatives] = slots;

  return (
    <section className="cs-card overflow-hidden">
      <div className="border-b border-line bg-primary-soft p-5">
        <div className="flex items-center gap-2 text-primary">
          <IconSparkle size={16} />
          <h3 className="text-xs font-bold uppercase tracking-[0.08em]">Recommended slot</h3>
        </div>

        <p className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">
          {DAYS[top.day_of_week].long}, {top.period_label}
        </p>
        <p className="mt-1 text-sm text-muted">
          Typically {formatTimeRange(top.typical_start, top.typical_end)}
        </p>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="cs-numeric text-3xl font-bold leading-none text-primary">
            {top.member_count}
          </span>
          <span className="text-sm text-muted">
            of {top.total_members} members free
          </span>
          <span className="cs-pill ml-1 border-[#35c6b159] bg-primary-soft text-primary">
            {top.pct}%
          </span>
        </div>

        <Link href={scheduleHref(top, clubId)} className="cs-btn cs-btn-primary mt-4">
          Schedule this slot
          <IconArrowRight size={16} />
        </Link>
        <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-muted">
          This is an availability estimate from what members told us, not a confirmed headcount.
          Nothing is scheduled until you publish it.
        </p>
      </div>

      {alternatives.length > 0 ? (
        <div className="p-5">
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
            Alternatives
          </h4>
          <ul className="mt-3 space-y-2">
            {alternatives.map((slot) => (
              <li key={`${slot.day_of_week}-${slot.period}`}>
                <Link
                  href={scheduleHref(slot, clubId)}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas-deep px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-surface-hover"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {DAYS[slot.day_of_week].long}, {slot.period_label}
                    </span>
                    <span className="block text-[0.6875rem] text-muted">
                      {formatTimeRange(slot.typical_start, slot.typical_end)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="cs-numeric text-sm font-bold text-ink">
                      {slot.member_count}
                    </span>
                    <span className="cs-numeric text-[0.6875rem] text-muted">{slot.pct}%</span>
                    <IconArrowRight
                      size={15}
                      className="text-muted-dim transition-colors group-hover:text-primary"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
