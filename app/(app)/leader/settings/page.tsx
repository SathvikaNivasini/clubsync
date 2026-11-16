import type { Metadata } from "next";
import Link from "next/link";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { ClubCodeCard } from "@/components/clubs/club-code-card";
import { ClubSettingsForm } from "@/components/clubs/club-settings-form";
import { PushToggle } from "@/components/notifications/push-toggle";
import { Alert } from "@/components/ui/alert";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatTile } from "@/components/ui/stat-tile";
import { requireLeader } from "@/lib/auth";
import { formatRelative } from "@/lib/format";
import { getClubOverview } from "@/lib/leader";

export const metadata: Metadata = { title: "Club settings" };
export const dynamic = "force-dynamic";

export default async function ClubSettingsPage() {
  const { club, admin, supabase } = await requireLeader();
  const overview = await getClubOverview(supabase, club.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeading
        as="h1"
        title="Club settings"
        description={`Administrative settings for ${club.name}.`}
      />

      {admin.must_change_password ? (
        <Alert tone="warning" title="Change your provisioned password">
          Your club was issued a one-time password. Replace it below before sharing the club code.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Members" value={overview.total_members} tone="primary" />
        <StatTile
          label="Club created"
          value={<span className="text-base font-bold">{formatRelative(club.created_at)}</span>}
        />
      </div>

      <ClubCodeCard code={club.code} joinEnabled={club.join_enabled} />
      <ClubSettingsForm club={club} />

      <div className="cs-card space-y-2 p-5">
        <h2 className="text-sm font-bold text-ink">Your leader account</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Club login</dt>
            <dd className="font-mono font-semibold text-ink">{admin.admin_handle}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Last sign-in</dt>
            <dd className="text-ink">
              {admin.last_login_at ? formatRelative(admin.last_login_at) : "this session"}
            </dd>
          </div>
        </dl>
        <p className="pt-1 text-xs leading-relaxed text-muted">
          The club login and its club cannot be changed from here — that pairing is immutable in
          the database so an administrator can never be pointed at another club.
        </p>
      </div>

      <ChangePasswordForm required={admin.must_change_password} />

      <PushToggle />

      <Alert tone="info" title="What you are not able to see">
        ClubSync gives leaders no read access to member records or individual availability. Your
        dashboard is built from aggregate functions that return counts only. This is enforced by
        database policy, not just by the interface.{" "}
        <Link href="/privacy" className="cs-link">
          The same page members read
        </Link>
        .
      </Alert>
    </div>
  );
}
