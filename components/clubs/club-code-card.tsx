"use client";

import { useState } from "react";

import { IconCheck } from "@/components/ui/icons";

export function ClubCodeCard({ code, joinEnabled }: { code: string; joinEnabled: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="cs-card space-y-3 p-5">
      <div>
        <h2 className="text-sm font-bold text-ink">Club code</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          This code is what lets a student join. There is no public club directory, so treat it
          like a door key — share it with your members, not publicly.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded-lg border border-line bg-canvas-deep px-4 py-2.5 font-mono text-xl font-bold tracking-[0.14em] text-primary">
          {code}
        </code>
        <button type="button" onClick={copy} className="cs-btn cs-btn-ghost text-sm">
          {copied ? (
            <>
              <IconCheck size={15} /> Copied
            </>
          ) : (
            "Copy code"
          )}
        </button>
      </div>

      {!joinEnabled ? (
        <p className="text-xs font-medium text-accent">
          Joining is currently switched off, so this code will not work until you re-enable it
          below.
        </p>
      ) : null}
    </div>
  );
}
