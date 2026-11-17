import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "./logo";
import { SignOut } from "./sign-out";

export function Shell({
  role,
  name,
  children,
}: {
  role: string;
  name: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/"><Wordmark size={26} /></Link>
          <div className="flex items-center gap-2">
            <span className="chip">
              <span className="font-mono">{name}</span>
              <span className="text-faint">· {role}</span>
            </span>
            <SignOut />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
