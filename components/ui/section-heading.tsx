import type { ReactNode } from "react";

export function SectionHeading({
  title,
  description,
  action,
  as: Tag = "h2",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <Tag className="text-lg font-bold tracking-tight text-ink sm:text-xl">{title}</Tag>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
