import type { Metadata } from "next";

import { NotificationList } from "@/components/notifications/notification-list";
import { PushToggle } from "@/components/notifications/push-toggle";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireMember } from "@/lib/auth";
import type { AppNotification } from "@/lib/types";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { supabase } = await requireMember("/notifications");

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  return (
    <div className="space-y-6">
      <SectionHeading
        as="h1"
        title="Notifications"
        description="The full history, kept in the app whether or not push notifications are available on your device."
      />
      <PushToggle />
      <NotificationList initial={(data ?? []) as AppNotification[]} />
    </div>
  );
}
