"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { IconLogout } from "@/components/ui/icons";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await supabaseBrowser().auth.signOut();
    } finally {
      startTransition(() => {
        router.replace("/login");
        router.refresh();
      });
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy || pending}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
    >
      <IconLogout size={17} />
      {compact ? null : <span>{busy || pending ? "Signing out…" : "Sign out"}</span>}
    </button>
  );
}
