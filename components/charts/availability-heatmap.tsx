"use client";

import { useState } from "react";

import { ChartFrame } from "./chart-frame";
import { DAYS, PERIODS } from "@/lib/constants";
import { HEAT_RAMP, HEAT_ZERO, heatColor } from "@/lib/viz";
import type { MatrixCell } from "@/lib/types";

interface HoverInfo {
  day: number;
  period: string;
  count: number;
  pct: number;
}

/**
 * The 7 x 4 availability grid.
 *
 * Built as a real CSS grid of buttons rather than an SVG chart so each cell is
 * focusable and carries its own accessible label. Colour encodes magnitude on
 * the validated single-hue ramp; the count is also printed inside every cell,
 * so the grid never relies on colour alone. The amber ring marks the best slot
 * — an annotation, deliberately outside the magnitude ramp.
 */
export function AvailabilityHeatmap({
  cells,
  totalMembers,
}: {
  cells: MatrixCell[];
  totalMembers: number;
}) {
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const max = Math.max(0, ...cells.map((c) => c.member_count));
  const lookup = new Map(cells.map((c) => [`${c.day_of_week}:${c.period}`, c]));
  const peakKeys = new Set(
    max > 0 ? cells.filter((c) => c.member_count === max).map((c) => `${c.day_of_week}:${c.period}`) : [],
  );

  return (
    <ChartFrame
      title="Availability heatmap"
      subtitle={
        max === 0
          ? "Nobody has submitted availability yet, so every cell is empty."
          : `Brighter means more members are free. The brightest cell is ${max} of ${totalMembers}.`
      }
      legend={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[0.6875rem] font-semibold text-muted">Fewer</span>
            <div className="flex gap-[2px]">
              {HEAT_RAMP.map((color, i) => (
                <span
                  key={color}
                  className="h-3 w-5 rounded-[3px]"
                  style={{ backgroundColor: color }}
                  aria-label={`Ramp step ${i + 1} of ${HEAT_RAMP.length}`}
                />
              ))}
            </div>
            <span className="text-[0.6875rem] font-semibold text-muted">More</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-3 w-5 rounded-[3px] border border-line"
              style={{ backgroundColor: HEAT_ZERO }}
            />
            <span className="text-[0.6875rem] text-muted">Nobody free</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-[3px] ring-2 ring-accent ring-offset-0" />
            <span className="text-[0.6875rem] text-muted">Best slot</span>
          </div>
        </div>
      }
      table={
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Members free for each day and time period</caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1.5 pr-4 font-semibold">Day</th>
              {PERIODS.map((p) => (
                <th key={p.key} scope="col" className="py-1.5 pr-4 font-semibold">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-ink">
            {DAYS.map((day) => (
              <tr key={day.index} className="border-t border-line">
                <th scope="row" className="py-1.5 pr-4 font-medium">{day.long}</th>
                {PERIODS.map((p) => {
                  const cell = lookup.get(`${day.index}:${p.key}`);
                  return (
                    <td key={p.key} className="cs-numeric py-1.5 pr-4">
                      {cell?.member_count ?? 0}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="overflow-x-auto">
        <div className="min-w-[22rem]">
          {/* Column headings: the seven days */}
          <div className="mb-[2px] grid grid-cols-[4.75rem_repeat(7,minmax(0,1fr))] gap-[2px]">
            <span />
            {DAYS.map((day) => (
              <span
                key={day.index}
                className="pb-1 text-center text-[0.6875rem] font-semibold text-muted"
              >
                <span className="hidden sm:inline">{day.short}</span>
                <span className="sm:hidden">{day.initial}</span>
              </span>
            ))}
          </div>

          {PERIODS.map((period) => (
            <div
              key={period.key}
              className="mb-[2px] grid grid-cols-[4.75rem_repeat(7,minmax(0,1fr))] items-stretch gap-[2px]"
            >
              <span className="flex items-center pr-2 text-[0.6875rem] font-semibold leading-tight text-muted">
                <span className="hidden sm:inline">{period.label}</span>
                <span className="sm:hidden">{period.short}</span>
              </span>

              {DAYS.map((day) => {
                const key = `${day.index}:${period.key}`;
                const cell = lookup.get(key);
                const count = cell?.member_count ?? 0;
                const pct = Number(cell?.pct ?? 0);
                const isPeak = peakKeys.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onMouseEnter={() =>
                      setHover({ day: day.index, period: period.label, count, pct })
                    }
                    onFocus={() => setHover({ day: day.index, period: period.label, count, pct })}
                    onMouseLeave={() => setHover(null)}
                    onBlur={() => setHover(null)}
                    aria-label={`${day.long}, ${period.label}: ${count} of ${totalMembers} members free, ${pct}%`}
                    className={`cs-numeric flex h-10 items-center justify-center rounded-md text-xs font-bold transition-transform hover:scale-[1.06] sm:h-11 ${
                      isPeak ? "ring-2 ring-accent" : ""
                    } ${count > 0 ? "text-[#06201c]" : "text-muted-dim"}`}
                    style={{ backgroundColor: heatColor(count, max) }}
                  >
                    {count > 0 ? count : ""}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* A single detail line rather than a floating tooltip: it works the same
          way for mouse, keyboard and touch. */}
      <p className="mt-3 min-h-[1.25rem] text-xs text-muted" aria-live="polite">
        {hover ? (
          <>
            <strong className="font-semibold text-ink">
              {DAYS[hover.day].long}, {hover.period}
            </strong>{" "}
            — {hover.count} of {totalMembers} members free ({hover.pct}%)
          </>
        ) : (
          "Hover or tab through a cell for exact numbers."
        )}
      </p>
    </ChartFrame>
  );
}
