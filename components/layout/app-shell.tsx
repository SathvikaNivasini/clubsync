import Link from "next/link";
import type { ReactNode } from "react";

import { BottomNav, SidebarNav, type NavItem } from "./app-nav";
import { SignOutButton } from "./sign-out-button";
import { Wordmark } from "@/components/ui/logo";
import { IconShield } from "@/components/ui/icons";

interface AppShellProps {
  items: NavItem[];
  identityLabel: string;
  identitySub: string;
  accentColor?: string;
  children: ReactNode;
}

export function AppShell({
  items,
  identityLabel,
  identitySub,
  accentColor = "#35C6B1",
  children,
}: AppShellProps) {
  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/50 px-4 py-5 lg:flex">
        <Link href="/" className="mb-7 block px-2">
          <Wordmark />
        </Link>

        <SidebarNav items={items} />

        <div className="mt-auto space-y-3 pt-6">
          <div className="rounded-xl border border-line bg-canvas-deep p-3">
            <div className="flex items-center gap-2">
              <span
                className="h-6 w-6 shrink-0 rounded-md"
                style={{ backgroundColor: `${accentColor}26`, border: `1px solid ${accentColor}59` }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{identityLabel}</p>
                <p className="truncate text-[0.6875rem] text-muted">{identitySub}</p>
              </div>
            </div>
          </div>
          <Link
            href="/privacy"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <IconShield size={17} />
            Privacy
          </Link>
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur-lg lg:hidden">
        <Link href="/">
          <Wordmark size={24} />
        </Link>
        <div className="flex items-center gap-2">
          <span className="cs-pill max-w-[9.5rem] truncate">{identityLabel}</span>
          <div className="w-9">
            <SignOutButton compact />
          </div>
        </div>
      </header>

      <main id="main" className="min-w-0 flex-1 pb-24 lg:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>

      <BottomNav items={items} />
    </div>
  );
}
