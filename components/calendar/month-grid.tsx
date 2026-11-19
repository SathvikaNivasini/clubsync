"use client";

import { DOW, addDays, gridStart, iso, monthLabel, sameDay } from "@/lib/dates";
import type { ReactNode } from "react";

/**
 * A month grid that renders whatever each screen needs inside a day cell.
 * Shared by the officer's time picker and everyone's meeting calendar.
 */
export function MonthGrid({
  month,
  onMonthChange,
  renderDay,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  renderDay: (dateISO: string, inMonth: boolean, isToday: boolean) => ReactNode;
}) {
  const start = gridStart(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = new Date();

  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="btn btn-ghost px-2.5 py-1.5 text-sm"
        >
          ‹
        </button>
        <p className="font-semibold">{monthLabel(month)}</p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="btn btn-ghost px-2.5 py-1.5 text-sm"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {DOW.map((d) => (
          <span key={d} className="pb-1 text-center text-[0.6875rem] font-semibold text-faint">
            {d[0]}
          </span>
        ))}
        {days.map((d) => (
          <div key={iso(d)}>{renderDay(iso(d), d.getMonth() === month.getMonth(), sameDay(d, today))}</div>
        ))}
      </div>
    </div>
  );
}
