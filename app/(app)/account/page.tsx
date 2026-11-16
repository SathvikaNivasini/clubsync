import type { Metadata } from "next";
import Link from "next/link";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { MemberSettings } from "@/components/account/member-settings";
import { Alert } from "@/components/ui/alert";
import { SectionHeading } from "@/components/ui/section-heading";
import { getMemberClubs, requireMember } from "@/lib/auth";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { member, supabase } = await requireMember("/account");
  const clubs = await getMemberClubs(supabase, member.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeading
        as="h1"
        title="Account"
        description="Your pseudonym, your password and what ClubSync is allowed to send you."
      />

      <div className="cs-card space-y-2 p-5">
        <h2 className="text-sm font-bold text-ink">Identity</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Username</dt>
            <dd className="font-mono font-semibold text-ink">{member.username}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Account created</dt>
            <dd className="text-ink">{formatRelative(member.created_at)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Recovery phrase set</dt>
            <dd className="text-ink">
              {member.recovery_phrase_set_at ? formatRelative(member.recovery_phrase_set_at) : "not set"}
            </dd>
          </div>
        </dl>
        <p className="pt-1 text-xs leading-relaxed text-muted">
          Usernames cannot be changed — availability, memberships and notifications are all tied to
          this identity.{" "}
          <Link href="/privacy" className="cs-link">
            What ClubSync stores
          </Link>
          .
        </p>
      </div>

      <MemberSettings member={member} clubs={clubs} />
      <ChangePasswordForm />

      <Alert tone="info" title="Lost your recovery phrase?">
        A new one cannot be issued, because there is no email address or phone number to verify you
        against. Keep your password somewhere safe; if you still have it, your account is fine.
      </Alert>
    </div>
  );
}
