import type { AppSupabaseClient } from "./supabase/server";

import type { MeetingWithClub } from "@/components/calendar/meeting-card";
import { clubColorForIndex } from "./viz";
import type { Club, Meeting } from "./types";

interface MeetingRow extends Meeting {
  clubs: Pick<Club, "name" | "accent_color"> | null;
}

/**
 * Meetings for the clubs the caller can see. RLS already restricts the rows to
 * clubs the caller belongs to or administers, so no extra filter is needed —
 * but `clubIds` narrows it when a page only wants one club.
 */
export async function fetchMeetings(
  supabase: AppSupabaseClient,
  options: {
    from?: string;
    to?: string;
    clubIds?: string[];
    includeCancelled?: boolean;
    limit?: number;
    ascending?: boolean;
  } = {},
): Promise<MeetingWithClub[]> {
  let query = supabase
    .from("meetings")
    .select("*, clubs(name, accent_color)")
    .order("meeting_date", { ascending: options.ascending ?? true })
    .order("starts_at", { ascending: options.ascending ?? true });

  if (options.from) query = query.gte("meeting_date", options.from);
  if (options.to) query = query.lte("meeting_date", options.to);
  if (options.clubIds?.length) query = query.in("club_id", options.clubIds);
  if (!options.includeCancelled) query = query.eq("status", "scheduled");
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error || !data) return [];

  // Club colour: the club's own accent if set, otherwise a stable slot from the
  // validated categorical palette, keyed on first appearance.
  const seen = new Map<string, number>();
  return (data as MeetingRow[]).map((row) => {
    if (!seen.has(row.club_id)) seen.set(row.club_id, seen.size);
    const index = seen.get(row.club_id) ?? 0;
    return {
      ...row,
      clubName: row.clubs?.name ?? "Club",
      clubColor: row.clubs?.accent_color ?? clubColorForIndex(index),
    };
  });
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
