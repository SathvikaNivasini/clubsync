"use client";

import { slotShort } from "@/lib/slots";

/** The one interactive primitive in the app: a pressable, slightly extruded
 *  slot chip. Before school is warm, after school is cool — colour plus the
 *  label, never colour alone. */
export function SlotPill({
  slot,
  state,
  label,
  onClick,
  disabled,
  title,
}: {
  slot: string;
  state: "off" | "on" | "locked";
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const before = slot === "before_school";
  const palette =
    state === "on"
      ? before
        ? "bg-before text-white border-[#d8912f]"
        : "bg-after text-white border-[#3f79da]"
      : state === "locked"
        ? "bg-sunken text-faint border-line line-through"
        : before
          ? "bg-before-soft text-[#8a5a10] border-[#f6ddb2]"
          : "bg-after-soft text-[#2c5bb0] border-[#cfe0fb]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "locked"}
      title={title}
      aria-pressed={state === "on"}
      className={`tile w-full px-1.5 py-1 text-[0.6875rem] font-bold disabled:cursor-not-allowed ${palette}`}
    >
      {label ?? slotShort(slot)}
    </button>
  );
}
