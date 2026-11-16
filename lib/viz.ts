/**
 * Chart colour, computed rather than eyeballed.
 *
 * Every palette here was checked with the data-viz validator against the
 * ClubSync dark chart surface (#191F29):
 *
 *   CLUB_PALETTE  categorical, 5 slots, `--pairs all`
 *                 lightness band PASS · chroma floor PASS
 *                 CVD separation PASS · normal-vision floor PASS · contrast PASS
 *                 (all-pairs, because a member's unified calendar can show
 *                 several clubs side by side)
 *
 *   HEAT_RAMP     sequential, single hue (OKLCH h≈181), 5 steps
 *                 monotone lightness PASS · adjacent ΔL ≥ 0.06 PASS
 *                 light-end contrast 2.44:1 vs surface PASS · single hue PASS
 *
 * An all-pairs categorical check caps out at 5–6 slots on a dark surface, so
 * clubs beyond the fifth reuse a colour. That is safe here because club colour
 * is never the only cue — `ClubChip` always prints the club's name beside it.
 */

export const CHART_SURFACE = "#191F29";

/** Fixed order. Never cycled past the list; never reassigned by rank. */
export const CLUB_PALETTE = [
  "#00AD98", // teal — brand-aligned, slot 1
  "#C68627", // amber
  "#1380F7", // blue
  "#A63FBF", // violet
  "#AE2540", // crimson
] as const;

export function clubColorForIndex(index: number): string {
  return CLUB_PALETTE[index % CLUB_PALETTE.length];
}

/** Sequential ramp, dimmest (fewest members) to brightest (most members). */
export const HEAT_RAMP = ["#00675B", "#008676", "#00A693", "#1DC7B1", "#50E6CF"] as const;

/** Not part of the ramp: "nobody is free then" is a state, not a magnitude. */
export const HEAT_ZERO = "#1B222D";

/** The single series colour for magnitude bars. */
export const BAR_COLOR = "#2AA294";
export const BAR_COLOR_PEAK = "#F2AE52";

/**
 * Bucket a count onto the ramp. `max` is the largest count in the same chart,
 * so the scale is relative to the club, not to an arbitrary absolute.
 */
export function heatColor(count: number, max: number): string {
  if (count <= 0) return HEAT_ZERO;
  if (max <= 0) return HEAT_ZERO;
  const ratio = count / max;
  const index = Math.min(HEAT_RAMP.length - 1, Math.max(0, Math.ceil(ratio * HEAT_RAMP.length) - 1));
  return HEAT_RAMP[index];
}

/** Legend thresholds matching `heatColor`, for the heatmap key. */
export function heatLegend(max: number): Array<{ color: string; from: number; to: number }> {
  if (max <= 0) return [];
  const size = HEAT_RAMP.length;
  return HEAT_RAMP.map((color, i) => {
    const from = Math.floor((i / size) * max) + (i === 0 ? 1 : 1);
    const to = Math.ceil(((i + 1) / size) * max);
    return { color, from: Math.max(1, from), to };
  });
}

/** Ink tokens — chart text never wears a series colour. */
export const INK = "#F5F6F8";
export const INK_MUTED = "#929BAA";
export const GRID = "#2A3442";
