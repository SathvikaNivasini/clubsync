import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MeetingForm } from "@/components/meetings/meeting-form";
import { Alert } from "@/components/ui/alert";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireLeader } from "@/lib/auth";
import type { Meeting } from "@/lib/types";

export const metadata: Metadata = { title: "Edit meeting" };
export const dynamic = "force-dynamic";

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { club, supabase } = await requireLeader();
  const { id } = await params;

  const { data } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .eq("club_id", club.id)
    .maybeSingle();

  if (!data) notFound();
  const meeting = data as Meeting;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeading
        as="h1"
        title="Edit meeting"
        description="Changing the date, time, place or title notifies every member again."
      />

      {meeting.status === "cancelled" ? (
        <Alert tone="warning" title="This meeting is cancelled">
          Saving changes here does not reinstate it. Use the Reinstate action on the meetings list.
        </Alert>
      ) : null}

      <MeetingForm clubId={club.id} clubName={club.name} meeting={meeting} />
    </div>
  );
}
