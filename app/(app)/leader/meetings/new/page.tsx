import type { Metadata } from "next";

import { MeetingForm } from "@/components/meetings/meeting-form";
import { Alert } from "@/components/ui/alert";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireLeader } from "@/lib/auth";

export const metadata: Metadata = { title: "Schedule a meeting" };
export const dynamic = "force-dynamic";

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; period?: string; start?: string; end?: string; club?: string }>;
}) {
  const { club } = await requireLeader();
  const params = await searchParams;

  const prefilled = Boolean(params.date || params.period);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeading
        as="h1"
        title="Schedule a meeting"
        description={`Publishing notifies every member of ${club.name}.`}
      />

      {prefilled ? (
        <Alert tone="info" title="Pre-filled from your recommended slot">
          Nothing has been scheduled yet. Review the details and publish when you are ready.
        </Alert>
      ) : null}

      <MeetingForm
        clubId={club.id}
        clubName={club.name}
        defaults={{
          date: params.date,
          period: params.period,
          start: params.start,
          end: params.end,
        }}
      />
    </div>
  );
}
