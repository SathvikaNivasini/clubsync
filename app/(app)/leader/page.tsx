import type { Metadata } from "next";
import Link from "next/link";

import { MeetingCard } from "@/components/calendar/meeting-card";
import { BestTimePanel } from "@/components/charts/best-time-panel";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import {
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconChart,
  IconPlus,
  IconUsers,
} from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatTile } from "@/components/ui/stat-tile";
import { requireLeader } from "@/lib/auth";
import { formatRelative } from "@/lib/format";
import { getBestTimes, getClubOverview } from "@/lib/leader";
import { fetchMeetings, todayISO } from "@/lib/meetings";

export const metadata: Metadata = { title: "Club dashboard" };
export const dynamic = "force-dynamic";

export default async function LeaderDashboard() {
  const { club, admin, supabase } = await requireLeader();

  const [overview, bestTimes, upcoming] = await Promise.all([
    getClubOverview(supabase, club.id),
    getBestTimes(supabase, club.id, 4),
    fetchMeetings(supabase, { from: todayISO(), clubIds: [club.id], limit: 3 }),
  ]);

  return (
    <div className="space-y-7">
      <SectionHeading
        as="h1"
        title={club.name}
        description={
          club.school
            ? `${club.school} · club code ${club.code}`
            : `Club code ${club.code}`
        }
        action={
          <Link href="/leader/meetings/new" className="cs-btn cs-btn-primary text-sm">
            <IconPlus size={15} />
            Schedule a meeting
          </Link>
        }
      />

      {admin.must_change_password ? (
        <Alert tone="warning" title="You are still using the password your club was issued">
          Choose your own before sharing the club code with members.{" "}
          <Link href="/leader/settings" className="cs-link font-semibold">
            Change it in club settings
          </Link>
          .
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Total members"
          value={overview.total_members}
          tone="primary"
          icon={<IconUsers size={16} />}
        />
        <StatTile
          label="Submitted availability"
          value={overview.submitted_count}
          hint={`${overview.submission_rate}% of the club`}
          tone="primary"
          icon={<IconCheck size={16} />}
        />
        <StatTile
          label="Still to submit"
          value={overview.pending_count}
          hint={
            overview.pending_count === 0
              ? "Everyone has replied"
              : "They are not identified to you"
          }
          tone={overview.pending_count > 0 ? "accent" : "neutral"}
        />
        <StatTile
          label="Upcoming meetings"
          value={overview.upcoming_meetings}
          hint={
            overview.last_submission_at
              ? `Data updated ${formatRelative(overview.last_submission_at)}`
              : "No availability yet"
          }
          icon={<IconCalendar size={16} />}
        />
      </div>

      {overview.total_members === 0 ? (
        <EmptyState
          icon={<IconUsers size={20} />}
          title="Nobody has joined yet"
          description={`Share the club code ${club.code} with your members. They create an anonymous account, enter the code, and start marking when they are free.`}
          action={
            <Link href="/leader/settings" className="cs-btn cs-btn-ghost">
              Club settings and code
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <BestTimePanel slots={bestTimes} clubId={club.id} />

          <div className="space-y-5">
            <section className="cs-card space-y-3 p-5">
              <h2 className="text-sm font-bold text-ink">Submission progress</h2>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-canvas-deep"
                role="img"
                aria-label={`${overview.submitted_count} of ${overview.total_members} members have submitted availability`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${Math.min(100, overview.submission_rate)}%` }}
                />
              </div>
              <p className="text-sm text-muted">
                <strong className="font-semibold text-ink">{overview.submitted_count}</strong> of{" "}
                {overview.total_members} members have told you when they are free.
                {overview.pending_count > 0 ? (
                  <>
                    {" "}
                    The remaining {overview.pending_count} are deliberately not identified — nudge
                    the whole club rather than individuals.
                  </>
                ) : null}
              </p>
              <Link href="/leader/analytics" className="cs-btn cs-btn-ghost w-full text-sm">
                <IconChart size={15} />
                Open availability analytics
                <IconArrowRight size={15} />
              </Link>
            </section>

            <section className="space-y-3">
              <SectionHeading
                title="Upcoming meetings"
                action={
                  <Link href="/leader/meetings" className="cs-btn cs-btn-ghost text-sm">
                    Manage
                  </Link>
                }
              />
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<IconCalendar size={20} />}
                  title="Nothing scheduled"
                  description="Pick a recommended slot and publish your first meeting."
                  action={
                    <Link href="/leader/meetings/new" className="cs-btn cs-btn-primary">
                      <IconPlus size={15} />
                      Schedule a meeting
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {upcoming.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      showClub={false}
                      showEstimate
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
