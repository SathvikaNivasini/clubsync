import type { Metadata } from "next";
import Link from "next/link";

import { AvailabilityEditor, type EditorSlot, type EditorWindow } from "@/components/availability/availability-editor";
import { Alert } from "@/components/ui/alert";
import { ClubDot } from "@/components/ui/club-dot";
import { EmptyState } from "@/components/ui/empty-state";
import { IconArrowRight, IconUsers } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/section-heading";
import { getMemberClubs, requireMember } from "@/lib/auth";
import { clubColorForIndex } from "@/lib/viz";

export const metadata: Metadata = { title: "My availability" };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const { member, supabase } = await requireMember("/availability");
  const clubs = await getMemberClubs(supabase, member.id);
  const { club: requestedClub } = await searchParams;

  if (clubs.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeading
          as="h1"
          title="My availability"
          description="Tell your club leaders when you can actually make it."
        />
        <EmptyState
          icon={<IconUsers size={20} />}
          title="Join a club first"
          description="Availability is collected per club, so there is nothing to fill in until you have joined one."
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

  const active =
    clubs.find((c) => c.club.id === requestedClub) ?? clubs[0];

  const [{ data: slots }, { data: windows }] = await Promise.all([
    supabase
      .from("availability")
      .select("day_of_week, period")
      .eq("club_id", active.club.id)
      .eq("member_id", member.id),
    supabase
      .from("availability_windows")
      .select("day_of_week, starts_at, ends_at")
      .eq("club_id", active.club.id)
      .eq("member_id", member.id),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeading
        as="h1"
        title="My availability"
        description="Only you can see these choices. Your leader sees how many members picked each slot, never who."
      />

      {clubs.length > 1 ? (
        <nav aria-label="Choose a club" className="flex flex-wrap gap-2">
          {clubs.map((entry, index) => {
            const isActive = entry.club.id === active.club.id;
            const color = entry.club.accent_color || clubColorForIndex(index);
            return (
              <Link
                key={entry.club.id}
                href={`/availability?club=${entry.club.id}`}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
                }`}
              >
                <ClubDot color={color} size={7} />
                {entry.club.name}
                {entry.slotCount === 0 && entry.windowCount === 0 ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="no availability yet" />
                ) : null}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <AvailabilityEditor
        key={active.club.id}
        clubId={active.club.id}
        clubName={active.club.name}
        initialSlots={(slots ?? []) as EditorSlot[]}
        initialWindows={(windows ?? []) as EditorWindow[]}
        lastUpdated={active.lastUpdated}
      />

      <Alert tone="info" title="Availability is not an RSVP">
        Marking a slot tells your leader you could usually make it then. It does not commit you to
        attending, and your leader is shown the same caveat when they schedule.
      </Alert>
    </div>
  );
}
