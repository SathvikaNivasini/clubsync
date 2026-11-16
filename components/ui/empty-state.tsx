import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="cs-card-quiet flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon ? (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-raised text-muted">
          {icon}
        </div>
      ) : null}
      <p className="text-base font-semibold text-ink">{title}</p>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
