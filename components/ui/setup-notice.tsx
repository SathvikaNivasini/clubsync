import Link from "next/link";

import { Alert } from "./alert";
import { Wordmark } from "./logo";

/** Shown instead of a broken page when Supabase credentials are absent. */
export function SetupNotice() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-5 py-16">
      <Wordmark size={32} />
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        ClubSync needs its database credentials
      </h1>
      <Alert tone="warning" title="Not configured yet">
        <p>
          The application code is complete, but no Supabase project is wired up. Copy{" "}
          <code className="rounded bg-canvas-deep px-1.5 py-0.5 font-mono text-[0.8125rem] text-ink">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-canvas-deep px-1.5 py-0.5 font-mono text-[0.8125rem] text-ink">
            .env.local
          </code>
          , fill in your project URL and keys, apply the migrations in{" "}
          <code className="rounded bg-canvas-deep px-1.5 py-0.5 font-mono text-[0.8125rem] text-ink">
            supabase/migrations
          </code>
          , then restart the dev server.
        </p>
      </Alert>
      <p className="text-sm text-muted">
        The full setup walkthrough is in <strong className="text-ink">README.md</strong>. Nothing in
        ClubSync uses mock data, so the interface stays empty until the database is reachable.
      </p>
      <Link href="/" className="cs-link text-sm">
        Back to the landing page
      </Link>
    </main>
  );
}
