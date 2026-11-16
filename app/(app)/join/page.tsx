import type { Metadata } from "next";

import { JoinClubForm } from "@/components/clubs/join-club-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Join a club" };

export default async function JoinPage() {
  await requireMember("/join");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <SectionHeading
        as="h1"
        title="Join a club"
        description="One account works for as many clubs as you like. Enter a club code to add another."
      />
      <JoinClubForm />
    </div>
  );
}
