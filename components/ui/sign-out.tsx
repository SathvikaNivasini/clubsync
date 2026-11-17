"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await supabaseBrowser().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className="btn btn-ghost px-2.5 py-1.5 text-xs"
    >
      {busy ? "…" : "Sign out"}
    </button>
  );
}
