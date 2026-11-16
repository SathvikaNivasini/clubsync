import type { ReactNode } from "react";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneStyles: Record<AlertTone, { wrap: string; dot: string }> = {
  info: { wrap: "border-line-strong bg-surface-raised text-ink", dot: "bg-info" },
  success: { wrap: "border-[#4ed2a659] bg-[#4ed2a614] text-ink", dot: "bg-success" },
  warning: { wrap: "border-[#f2ae5259] bg-accent-soft text-ink", dot: "bg-accent" },
  danger: { wrap: "border-[#f2635c59] bg-danger-soft text-ink", dot: "bg-danger" },
};

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
}) {
  const styles = toneStyles[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex gap-3 rounded-xl border p-3.5 text-sm ${styles.wrap}`}
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${styles.dot}`} aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed text-muted [&_strong]:text-ink">{children}</div> : null}
      </div>
    </div>
  );
}
