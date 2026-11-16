import type { Metadata } from "next";
import Link from "next/link";

import { MeetingCard } from "@/components/calendar/meeting-card";
import { PushToggle } from "@/components/notifications/push-toggle";
import { Alert } from "@/components/ui/alert";
import { ClubDot } from "@/components/ui/club-dot";
import { EmptyState } from "@/components/ui/empty-state";
import {
  IconArrowRight,
  IconBell,
  IconCalendar,
  IconCheck,
  IconGrid,
  IconUsers,
} from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatTile } from "@/components/ui/stat-tile";
import { getMemberClubs, requireMember } from "@/lib/auth";
import { formatRelative } from "@/lib/format";
import { fetchMeetings, todayISO } from "@/lib/meetings";
import { clubColorForIndex } from "@/lib/viz";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function MemberDashboard() {
  const { member, supabase } = await requireMember();
  const clubs = await getMemberClubs(supabase, member.id);

  const [meetings, unread] = await Promise.all([
    fetchMeetings(supabase, { from: todayISO(), limit: 4 }),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  const submitted = clubs.filter((c) => c.slotCount > 0 || c.windowCount > 0);
  const pending = clubs.filter((c) => c.slotCount === 0 && c.windowCount === 0);
  const nextMeeting = meetings[0];

  return (
    <div className="space-y-7">
      <SectionHeading
        as="h1"
        title={`Hi, ${member.username}`}
        description="Your availability, your clubs and everything coming up — in one place."
      />

      {clubs.length === 0 ? (
        <EmptyState
          icon={<IconUsers size={20} />}
          title="You have not joined a club yet"
          description="Ask your club leader for the club code, then enter it to join. One account covers every club you are in."
          action={
            <Link href="/join" className="cs-btn cs-btn-primary">
              Join a club
              <IconArrowRight size={16} />
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Clubs joined"
              value={clubs.length}
              tone="primary"
              icon={<IconUsers size={16} />}
            />
            <StatTile
              label="Availability sent"
              value={`${submitted.length}/${clubs.length}`}
              hint={pending.length > 0 ? `${pending.length} still waiting on you` : "All up to date"}
              tone={pending.length > 0 ? "accent" : "primary"}
              icon={<IconGrid size={16} />}
            />
            <StatTile
              label="Upcoming meetings"
              value={meetings.length}
              hint={nextMeeting ? `Next: ${nextMeeting.clubName}` : "Nothing scheduled yet"}
              icon={<IconCalendar size={16} />}
            />
            <StatTile
              label="Unread alerts"
              value={unread.count ?? 0}
              tone={(unread.count ?? 0) > 0 ? "accent" : "neutral"}
              icon={<IconBell size={16} />}
            />
          </div>

          {pending.length > 0 ? (
            <Alert tone="warning" title="Some clubs are still waiting for your availability">
              Your leader cannot count you in{" "}
              <strong>{pending.map((c) => c.club.name).join(", ")}</strong> until you mark when you
              are free.{" "}
              <Link href="/availability" className="cs-link font-semibold">
                Set it now
              </Link>
              .
            </Alert>
          ) : null}

          {nextMeeting ? (
            <section className="space-y-3">
              <SectionHeading title="Next up" />
              <MeetingCard meeting={nextMeeting} />
            </section>
          ) : null}

          <section className="space-y-3">
            <SectionHeading
              title="Your clubs"
              description="Availability is per club, because your schedule for one might not suit another."
              action={
                <Link href="/join" className="cs-btn cs-btn-ghost text-sm">
                  Join another
                </Link>
              }
            />

            <ul className="grid gap-3 sm:grid-cols-2">
              {clubs.map((entry, index) => {
                const color = entry.club.accent_color || clubColorForIndex(index);
                const hasSubmitted = entry.slotCount > 0 || entry.windowCount > 0;
                return (
                  <li key={entry.club.id}>
                    <div className="cs-card h-full space-y-3 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="flex items-center gap-2 text-base font-bold tracking-tight text-ink">
                            <ClubDot color={color} />
                            <span className="truncate">{entry.club.name}</span>
                          </h3>
                          <p className="mt-0.5 font-mono text-xs text-muted">{entry.club.code}</p>
                        </div>
                        <span className="cs-pill shrink-0">Member #{entry.memberNumber}</span>
                      </div>

                      {entry.club.description ? (
                        <p className="line-clamp-2 text-sm leading-relaxed text-muted">
                          {entry.club.description}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {hasSubmitted ? (
                          <>
                            <span className="cs-pill border-[#4ed2a659] bg-[#4ed2a614] text-success">
                              <IconCheck size={12} />
                              {entry.slotCount} {entry.slotCount === 1 ? "slot" : "slots"}
                            </span>
                            {entry.windowCount > 0 ? (
                              <span className="cs-pill border-[#f2ae5259] bg-accent-soft text-accent">
                                {entry.windowCount} custom
                              </span>
                            ) : null}
                            <span className="text-muted">
                              updated {formatRelative(entry.lastUpdated)}
                            </span>
                          </>
                        ) : (
                          <span className="cs-pill border-[#f2ae5259] bg-accent-soft text-accent">
                            No availability yet
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/availability?club=${entry.club.id}`}
                        className="cs-btn cs-btn-ghost w-full text-sm"
                      >
                        {hasSubmitted ? "Update availability" : "Set availability"}
                        <IconArrowRight size={15} />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {meetings.length > 1 ? (
            <section className="space-y-3">
              <SectionHeading
                title="Coming up"
                action={
                  <Link href="/calendar" className="cs-btn cs-btn-ghost text-sm">
                    Full calendar
                  </Link>
                }
              />
              <div className="space-y-3">
                {meetings.slice(1).map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <section className="space-y-3">
        <SectionHeading title="Notifications" />
        <PushToggle />
      </section>
    </div>
  );
}
