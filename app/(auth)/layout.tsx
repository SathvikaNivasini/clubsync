import Link from "next/link";

import { Wordmark } from "@/components/ui/logo";
import { SetupNotice } from "@/components/ui/setup-notice";
import { isConfigured } from "@/lib/supabase/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!isConfigured()) return <SetupNotice />;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-5 sm:px-8">
        <Link href="/" className="inline-block">
          <Wordmark />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md cs-rise">
          <div className="cs-card p-6 sm:p-8">{children}</div>
        </div>
      </main>
      <footer className="px-5 pb-8 text-center text-xs text-muted-dim sm:px-8">
        <Link href="/privacy" className="cs-link">
          What ClubSync does and does not store
        </Link>
      </footer>
    </div>
  );
}
