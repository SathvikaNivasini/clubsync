"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Shared chrome for every chart: title, one-line read, the plot, and a
 * disclosure that reveals the same numbers as a table. The table is not
 * decoration — it is the accessible path to the data and the fallback when
 * colour is unavailable.
 */
export function ChartFrame({
  title,
  subtitle,
  children,
  table,
  legend,
  footnote,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  table?: ReactNode;
  legend?: ReactNode;
  footnote?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <section className="cs-card p-4 sm:p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-bold tracking-tight text-ink">{title}</h3>
          {subtitle ? <p className="text-xs leading-relaxed text-muted">{subtitle}</p> : null}
        </div>
        {table ? (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-expanded={showTable}
            aria-controls={tableId}
            className="shrink-0 rounded-md border border-line px-2 py-1 text-[0.6875rem] font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {showTable ? "Hide numbers" : "Show numbers"}
          </button>
        ) : null}
      </header>

      {children}

      {legend ? <div className="mt-3">{legend}</div> : null}

      {table ? (
        <div id={tableId} hidden={!showTable} className="mt-4 overflow-x-auto">
          {table}
        </div>
      ) : null}

      {footnote ? <p className="mt-3 text-[0.6875rem] leading-relaxed text-muted-dim">{footnote}</p> : null}
    </section>
  );
}

export function ChartTooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line-strong bg-canvas-deep px-2.5 py-2 text-xs shadow-lifted">
      {children}
    </div>
  );
}
