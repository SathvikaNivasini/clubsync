import type { Metadata } from "next";
import Link from "next/link";

import { AvailabilityHeatmap } from "@/components/charts/availability-heatmap";
import { BestTimePanel } from "@/components/charts/best-time-panel";
import { DayBarChart } from "@/components/charts/day-bar-chart";
import { PeriodBarChart } from "@/components/charts/period-bar-chart";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { IconUsers } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatTile } from "@/components/ui/stat-tile";
import { requireLeader } from "@/lib/auth";
import { DAYS } from "@/lib/constants";
import { formatRelative, formatTime } from "@/lib/format";
import {
  getAvailabilityMatrix,
  getBestTimes,
  getClubOverview,
  getDayTotals,
  getPeriodTotals,
  getWindowHistogram,
} from "@/lib/leader";

export const metadata: Metadata = { title: "Availability analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { club, supabase } = await requireLeader();

  const [overview, matrix, dayTotals, periodTotals, bestTimes, windows] = await Promise.all([
    getClubOverview(supabase, club.id),
    getAvailabilityMatrix(supabase, club.id),
    getDayTotals(supabase, club.id),
    getPeriodTotals(supabase, club.id),
    getBestTimes(supabase, club.id, 6),
    getWindowHistogram(supabase, club.id),
  ]);

  const windowPeak = windows.reduce(
    (acc, cell) => (cell.member_count > acc.member_count ? cell : acc),
    { day_of_week: -1, hour_slot: -1, member_count: 0 },
  );

  return (
    <div className="space-y-7">
      <SectionHeading
        as="h1"
        title="Availability analytics"
        description="Every number here is an aggregate count. ClubSync has no query that would tell you which member picked which slot."
      />

      {overview.total_members === 0 ? (
        <EmptyState
          icon={<IconUsers size={20} />}
          title="No members yet"
          description={`Share the club code ${club.code} so members can join and submit availability.`}
        />
      ) : overview.submitted_count === 0 ? (
        <Alert tone="warning" title="No availability submitted yet">
          {overview.total_members} {overview.total_members === 1 ? "member has" : "members have"}{" "}
          joined, but nobody has filled in their grid. The charts below will fill in as soon as
          they do.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Members" value={overview.total_members} tone="primary" />
        <StatTile
          label="Submitted"
          value={overview.submitted_count}
          hint={`${overview.submission_rate}% response rate`}
          tone="primary"
        />
        <StatTile
          label="Not submitted"
          value={overview.pending_count}
          tone={overview.pending_count > 0 ? "accent" : "neutral"}
        />
        <StatTile
          label="Freshest data"
          value={
            <span className="text-base font-bold">
              {overview.last_submission_at ? formatRelative(overview.last_submission_at) : "—"}
            </span>
          }
        />
      </div>

      <AvailabilityHeatmap cells={matrix} totalMembers={overview.total_members} />

      <div className="grid gap-5 lg:grid-cols-2">
        <DayBarChart data={dayTotals} totalMembers={overview.total_members} />
        <PeriodBarChart data={periodTotals} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <BestTimePanel slots={bestTimes} clubId={club.id} />

        <section className="cs-card space-y-3 p-5">
          <div>
            <h2 className="text-sm font-bold text-ink">Precise time ranges</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Some members give an exact window rather than a whole period. These are counted by
              hour, aggregated across the club — never shown per member.
            </p>
          </div>

          {windows.length === 0 ? (
            <p className="text-sm text-muted">
              No custom time ranges submitted. Members can add them on their availability page when
              a period is too blunt.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">
                Busiest hour:{" "}
                <strong className="font-semibold text-ink">
                  {DAYS[windowPeak.day_of_week]?.long ?? "—"} at{" "}
                  {formatTime(`${String(windowPeak.hour_slot).padStart(2, "0")}:00`)}
                </strong>{" "}
                with {windowPeak.member_count}{" "}
                {windowPeak.member_count === 1 ? "member" : "members"} free.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[18rem] text-left text-xs">
                  <caption className="sr-only">
                    Members with a custom time range covering each hour
                  </caption>
                  <thead>
                    <tr className="text-muted">
                      <th scope="col" className="py-1.5 pr-4 font-semibold">Day</th>
                      <th scope="col" className="py-1.5 pr-4 font-semibold">Hour</th>
                      <th scope="col" className="py-1.5 font-semibold">Members free</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink">
                    {windows.slice(0, 14).map((cell) => (
                      <tr
                        key={`${cell.day_of_week}-${cell.hour_slot}`}
                        className="border-t border-line"
                      >
                        <th scope="row" className="py-1.5 pr-4 font-medium">
                          {DAYS[cell.day_of_week]?.long ?? cell.day_of_week}
                        </th>
                        <td className="cs-numeric py-1.5 pr-4">
                          {formatTime(`${String(cell.hour_slot).padStart(2, "0")}:00`)}
                        </td>
                        <td className="cs-numeric py-1.5">{cell.member_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {windows.length > 14 ? (
                <p className="text-xs text-muted-dim">
                  Showing the first 14 of {windows.length} hour buckets.
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>

      <Alert tone="info" title="How to read these numbers">
        Availability means &ldquo;I could usually make it then&rdquo;, not &ldquo;I will be
        there&rdquo;. Members are never asked to confirm attendance, so treat the counts as the best
        time to reach the most people — not as a headcount.{" "}
        <Link href="/privacy" className="cs-link">
          What members are told
        </Link>
        .
      </Alert>
    </div>
  );
}
