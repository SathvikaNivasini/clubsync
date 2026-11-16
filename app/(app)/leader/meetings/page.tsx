import type { Metadata } from "next";
import Link from "next/link";

import { MeetingCard } from "@/components/calendar/meeting-card";
import { MeetingActions } from "@/components/meetings/meeting-actions";
import { CalendarView } from "@/components/calendar/calendar-view";
import { EmptyState } from "@/components/ui/empty-state";
import { IconCalendar, IconPlus } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireLeader } from "@/lib/auth";
import { addDays, toDateOnly } from "@/lib/format";
import { fetchMeetings, todayISO } from "@/lib/meetings";

export const metadata: Metadata = { title: "Meetings" };
export const dynamic = "force-dynamic";

export default async function LeaderMeetingsPage() {
  const { club, supabase } = await requireLeader();
  const today = todayISO();

  const all = await fetchMeetings(supabase, {
    clubIds: [club.id],
    from: toDateOnly(addDays(new Date(), -120)),
    to: toDateOnly(addDays(new Date(), 240)),
    includeCancelled: true,
  });

  const upcoming = all.filter((m) => m.meeting_date >= today);
  const past = all.filter((m) => m.meeting_date < today).reverse();

  return (
    <div className="space-y-7">
      <SectionHeading
        as="h1"
        title="Meetings"
        description="Edit, reschedule or cancel. Members are notified automatically whenever the when or where changes."
        action={
          <Link href="/leader/meetings/new" className="cs-btn cs-btn-primary text-sm">
            <IconPlus size={15} />
            Schedule a meeting
          </Link>
        }
      />

      <section className="space-y-3">
        <SectionHeading title={`Upcoming (${upcoming.length})`} />
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<IconCalendar size={20} />}
            title="Nothing upcoming"
            description="Check your availability analytics for the best slot, then publish a meeting."
            action={
              <Link href="/leader/analytics" className="cs-btn cs-btn-ghost">
                See the best times
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((meeting) => (
              <li key={meeting.id}>
                <MeetingCard
                  meeting={meeting}
                  showClub={false}
                  showEstimate
                  actions={<MeetingActions meetingId={meeting.id} status={meeting.status} />}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading title={`Past (${past.length})`} />
          <ul className="space-y-3">
            {past.slice(0, 10).map((meeting) => (
              <li key={meeting.id}>
                <MeetingCard meeting={meeting} showClub={false} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionHeading
          title="Club calendar"
          description="The same meetings in month, week and day views — what your members see."
        />
        <CalendarView
          meetings={all}
          clubs={[{ id: club.id, name: club.name, color: club.accent_color }]}
          heading="Next up for this club"
        />
      </section>
    </div>
  );
}
