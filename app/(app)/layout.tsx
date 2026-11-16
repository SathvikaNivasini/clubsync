import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/app-nav";
import { SetupNotice } from "@/components/ui/setup-notice";
import { getViewer } from "@/lib/auth";
import { isConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isConfigured()) return <SetupNotice />;

  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  if (viewer.role === "leader") {
    const items: NavItem[] = [
      { href: "/leader", label: "Dashboard", icon: "home", exact: true },
      { href: "/leader/analytics", label: "Availability", shortLabel: "Analytics", icon: "chart" },
      { href: "/leader/meetings", label: "Meetings", icon: "calendar" },
      { href: "/leader/meetings/new", label: "Schedule", icon: "plus" },
      { href: "/leader/settings", label: "Club settings", shortLabel: "Settings", icon: "settings" },
    ];
    return (
      <AppShell
        items={items}
        identityLabel={viewer.club.name}
        identitySub={`Leader · ${viewer.admin.admin_handle}`}
        accentColor={viewer.club.accent_color}
      >
        {children}
      </AppShell>
    );
  }

  const { count } = await viewer.supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "home", exact: true },
    { href: "/availability", label: "My availability", shortLabel: "Availability", icon: "grid" },
    { href: "/calendar", label: "Calendar", icon: "calendar" },
    { href: "/notifications", label: "Notifications", shortLabel: "Alerts", icon: "bell", badge: count ?? 0 },
    { href: "/join", label: "Join a club", shortLabel: "Join", icon: "plus" },
  ];

  return (
    <AppShell
      items={items}
      identityLabel={viewer.member.username}
      identitySub="Anonymous member"
    >
      {children}
    </AppShell>
  );
}
