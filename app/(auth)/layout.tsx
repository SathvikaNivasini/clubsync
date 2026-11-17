import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";
import { isConfigured } from "@/lib/supabase/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!isConfigured()) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
        <Wordmark />
        <div className="card p-6">
          <p className="font-semibold">Not connected yet</p>
          <p className="mt-1 text-sm text-muted">
            Set the Supabase keys in the environment, then redeploy.
          </p>
        </div>
      </main>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-5">
        <Link href="/"><Wordmark /></Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm rise">{children}</div>
      </main>
    </div>
  );
}
