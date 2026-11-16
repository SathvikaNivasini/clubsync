import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "primary" | "accent" | "danger";
  icon?: ReactNode;
}

const toneClasses: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-ink",
  primary: "text-primary",
  accent: "text-accent",
  danger: "text-danger",
};

export function StatTile({ label, value, hint, tone = "neutral", icon }: StatTileProps) {
  return (
    <div className="cs-card flex flex-col gap-1 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </span>
        {icon ? <span className="text-muted-dim">{icon}</span> : null}
      </div>
      <span className={`cs-numeric text-[1.75rem] font-bold leading-none sm:text-[2rem] ${toneClasses[tone]}`}>
        {value}
      </span>
      {hint ? <span className="text-[0.8125rem] leading-snug text-muted">{hint}</span> : null}
    </div>
  );
}
