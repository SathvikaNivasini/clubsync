"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartFrame, ChartTooltipBox } from "./chart-frame";
import { DAYS } from "@/lib/constants";
import { BAR_COLOR, BAR_COLOR_PEAK, GRID, INK_MUTED } from "@/lib/viz";
import type { DayTotal } from "@/lib/types";

interface Row {
  day: string;
  dayLong: string;
  members: number;
  pct: number;
  peak: boolean;
}

function DayTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row }> }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <ChartTooltipBox>
      <p className="font-semibold text-ink">{row.dayLong}</p>
      <p className="text-muted">
        {row.members} {row.members === 1 ? "member" : "members"} free · {row.pct}% of the club
      </p>
    </ChartTooltipBox>
  );
}

/**
 * One series — how many members are free on each weekday — so there is no
 * legend; the title names the measure. The single peak bar is the only one
 * directly labelled and the only one in the accent colour.
 */
export function DayBarChart({ data, totalMembers }: { data: DayTotal[]; totalMembers: number }) {
  const max = Math.max(0, ...data.map((d) => d.member_count));
  const rows: Row[] = data.map((d) => ({
    day: DAYS[d.day_of_week]?.short ?? `D${d.day_of_week}`,
    dayLong: DAYS[d.day_of_week]?.long ?? `Day ${d.day_of_week}`,
    members: d.member_count,
    pct: Number(d.pct),
    peak: max > 0 && d.member_count === max,
  }));

  const empty = max === 0;

  return (
    <ChartFrame
      title="Members free, by day"
      subtitle={
        empty
          ? "No availability submitted yet."
          : `Counting distinct members across all four time periods. ${totalMembers} members in the club.`
      }
      table={
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Members free by day of the week</caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1.5 pr-4 font-semibold">Day</th>
              <th scope="col" className="py-1.5 pr-4 font-semibold">Members free</th>
              <th scope="col" className="py-1.5 font-semibold">Share of club</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {rows.map((r) => (
              <tr key={r.dayLong} className="border-t border-line">
                <th scope="row" className="py-1.5 pr-4 font-medium">{r.dayLong}</th>
                <td className="cs-numeric py-1.5 pr-4">{r.members}</td>
                <td className="cs-numeric py-1.5">{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-56 w-full" role="img" aria-label="Bar chart of members free by day of the week">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 18, right: 4, bottom: 0, left: -24 }} barCategoryGap="22%">
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tick={{ fill: INK_MUTED, fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: INK_MUTED, fontSize: 11 }}
              domain={[0, Math.max(1, max)]}
            />
            <Tooltip
              content={<DayTooltip />}
              cursor={{ fill: "#ffffff0a" }}
              animationDuration={120}
            />
            <Bar dataKey="members" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.dayLong} fill={r.peak ? BAR_COLOR_PEAK : BAR_COLOR} />
              ))}
              <LabelList
                dataKey="members"
                position="top"
                offset={7}
                className="cs-numeric"
                fill={INK_MUTED}
                fontSize={11}
                formatter={(value: number) => (max > 0 && value === max ? String(value) : "")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
