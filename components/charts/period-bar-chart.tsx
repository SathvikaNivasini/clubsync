"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartFrame, ChartTooltipBox } from "./chart-frame";
import { BAR_COLOR, BAR_COLOR_PEAK, GRID, INK_MUTED } from "@/lib/viz";
import type { PeriodTotal } from "@/lib/types";

interface Row {
  label: string;
  members: number;
  pct: number;
  peak: boolean;
}

function PeriodTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row }> }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <ChartTooltipBox>
      <p className="font-semibold text-ink">{row.label}</p>
      <p className="text-muted">
        {row.members} {row.members === 1 ? "member" : "members"} free · {row.pct}% of the club
      </p>
    </ChartTooltipBox>
  );
}

/**
 * Horizontal bars, because the categories are named phrases rather than a
 * sequence — reading them along the y-axis avoids rotated tick labels.
 */
export function PeriodBarChart({ data }: { data: PeriodTotal[] }) {
  const max = Math.max(0, ...data.map((d) => d.member_count));
  const rows: Row[] = data.map((d) => ({
    label: d.period_label,
    members: d.member_count,
    pct: Number(d.pct),
    peak: max > 0 && d.member_count === max,
  }));

  return (
    <ChartFrame
      title="Members free, by time of day"
      subtitle={
        max === 0
          ? "No availability submitted yet."
          : "Distinct members per period, counted across the whole week."
      }
      table={
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Members free by time period</caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1.5 pr-4 font-semibold">Period</th>
              <th scope="col" className="py-1.5 pr-4 font-semibold">Members free</th>
              <th scope="col" className="py-1.5 font-semibold">Share of club</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <th scope="row" className="py-1.5 pr-4 font-medium">{r.label}</th>
                <td className="cs-numeric py-1.5 pr-4">{r.members}</td>
                <td className="cs-numeric py-1.5">{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-56 w-full" role="img" aria-label="Bar chart of members free by time of day">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 2, right: 20, bottom: 0, left: 8 }}
            barCategoryGap="26%"
          >
            <XAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tick={{ fill: INK_MUTED, fontSize: 11 }}
              domain={[0, Math.max(1, max)]}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={96}
              tickLine={false}
              axisLine={false}
              tick={{ fill: INK_MUTED, fontSize: 11 }}
            />
            <Tooltip content={<PeriodTooltip />} cursor={{ fill: "#ffffff0a" }} animationDuration={120} />
            <Bar dataKey="members" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.label} fill={r.peak ? BAR_COLOR_PEAK : BAR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
