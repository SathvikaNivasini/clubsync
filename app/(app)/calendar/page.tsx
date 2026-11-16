import type { Metadata } from "next";
import Link from "next/link";

import { CalendarView } from "@/components/calendar/calendar-view";
import { EmptyState } from "@/components/ui/empty-state";
import { IconArrowRight, IconUsers } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { getMemberClubs, requireMember } from "@/lib/auth";
import { addDays, toDateOnly } from "@/lib/format";
import { fetchMeetings } from "@/lib/meetings";
import { clubColorForIndex } from "@/lib/viz";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function MemberCalendarPage() {
  const { member, supabase } = await requireMember("/calendar");
  const clubs = await getMemberClubs(supabase, member.id);

  if (clubs.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeading as="h1" title="Calendar" description="Every club you belong to, in one view." />
        <EmptyState
          icon={<IconUsers size={20} />}
          title="No clubs, no calendar"
          description="Join a club with its code and its meetings will show up here automatically."
          action={
            <Link href="/join" className="cs-btn cs-btn-primary">
              Join a club
              <IconArrowRight size={16} />
            </Link>
          }
        />
      </div>
    );
  }

  const today = new Date();
  const meetings = await fetchMeetings(supabase, {
    from: toDateOnly(addDays(today, -60)),
    to: toDateOnly(addDays(today, 180)),
    includeCancelled: true,
  });

  const clubKey = clubs.map((entry, index) => ({
    id: entry.club.id,
    name: entry.club.name,
    color: entry.club.accent_color || clubColorForIndex(index),
  }));

  return (
    <div className="space-y-6">
      <SectionHeading
        as="h1"
        title="Calendar"
        description={
          clubs.length > 1
            ? "Meetings from all of your clubs, colour-coded and labelled by club."
            : "Every meeting your club has scheduled."
        }
      />
      <CalendarView meetings={meetings} clubs={clubKey} heading="Upcoming meetings" />
    </div>
  );
}
