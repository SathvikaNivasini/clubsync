import type { ReactNode } from "react";

export function Empty({ icon, title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon ? <span className="text-3xl">{icon}</span> : null}
      <p className="font-semibold">{title}</p>
      {hint ? <p className="max-w-xs text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "good" | "warn" | "bad";
  children: ReactNode;
}) {
  const styles = {
    info: "border-line bg-surface text-muted",
    good: "border-[#bfe8e0] bg-primary-soft text-primary-dark",
    warn: "border-[#f6ddb2] bg-accent-soft text-[#8a5a10]",
    bad: "border-[#f3c9c6] bg-danger-soft text-danger",
  }[tone];
  return <div className={`rounded-xl border px-3.5 py-2.5 text-sm ${styles}`}>{children}</div>;
}

export function H1({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">{children}</h1>
      {sub ? <p className="text-sm text-muted">{sub}</p> : null}
    </div>
  );
}
