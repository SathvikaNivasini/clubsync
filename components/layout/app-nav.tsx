"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  IconBell,
  IconCalendar,
  IconChart,
  IconGrid,
  IconHome,
  IconPlus,
  IconSettings,
  IconUsers,
} from "@/components/ui/icons";

export type NavIconKey =
  | "home"
  | "grid"
  | "calendar"
  | "bell"
  | "chart"
  | "users"
  | "settings"
  | "plus";

const ICONS: Record<NavIconKey, (p: { size?: number }) => React.ReactElement> = {
  home: IconHome,
  grid: IconGrid,
  calendar: IconCalendar,
  bell: IconBell,
  chart: IconChart,
  users: IconUsers,
  settings: IconSettings,
  plus: IconPlus,
};

export interface NavItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: NavIconKey;
  badge?: number;
  /** Exact match only — stops "/leader" lighting up on "/leader/analytics". */
  exact?: boolean;
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary-soft text-primary"
                : "text-muted hover:bg-surface-hover hover:text-ink"
            }`}
          >
            <Icon size={17} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <span className="cs-numeric rounded-full bg-accent px-1.5 py-0.5 text-[0.6875rem] font-bold text-[#2a1c05]">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 px-1 py-2.5 text-[0.6875rem] font-semibold transition-colors ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                <span className="relative">
                  <Icon size={20} />
                  {item.badge ? (
                    <span className="absolute -right-2 -top-1.5 min-w-[1.05rem] rounded-full bg-accent px-1 text-center text-[0.625rem] font-bold leading-[1.05rem] text-[#2a1c05]">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
