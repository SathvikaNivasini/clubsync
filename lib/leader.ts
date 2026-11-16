import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BestTime,
  ClubOverview,
  DayTotal,
  MatrixCell,
  PeriodTotal,
} from "./types";

/**
 * Every leader-facing number comes from one of these aggregate RPCs.
 * None of them can return a member id — that is enforced in the database, not
 * here. See supabase/migrations/0003_clubsync_rpc.sql.
 */

const EMPTY_OVERVIEW: ClubOverview = {
  total_members: 0,
  submitted_count: 0,
  pending_count: 0,
  upcoming_meetings: 0,
  submission_rate: 0,
  last_submission_at: null,
};

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return (data as T) ?? null;
}

export async function getClubOverview(
  supabase: SupabaseClient,
  clubId: string,
): Promise<ClubOverview> {
  const { data, error } = await supabase.rpc("club_overview", { p_club: clubId });
  if (error) return EMPTY_OVERVIEW;
  return firstRow<ClubOverview>(data) ?? EMPTY_OVERVIEW;
}

export async function getAvailabilityMatrix(
  supabase: SupabaseClient,
  clubId: string,
): Promise<MatrixCell[]> {
  const { data, error } = await supabase.rpc("club_availability_matrix", { p_club: clubId });
  if (error || !Array.isArray(data)) return [];
  return data as MatrixCell[];
}

export async function getDayTotals(
  supabase: SupabaseClient,
  clubId: string,
): Promise<DayTotal[]> {
  const { data, error } = await supabase.rpc("club_day_totals", { p_club: clubId });
  if (error || !Array.isArray(data)) return [];
  return data as DayTotal[];
}

export async function getPeriodTotals(
  supabase: SupabaseClient,
  clubId: string,
): Promise<PeriodTotal[]> {
  const { data, error } = await supabase.rpc("club_period_totals", { p_club: clubId });
  if (error || !Array.isArray(data)) return [];
  return data as PeriodTotal[];
}

export async function getBestTimes(
  supabase: SupabaseClient,
  clubId: string,
  limit = 5,
): Promise<BestTime[]> {
  const { data, error } = await supabase.rpc("club_best_times", {
    p_club: clubId,
    p_limit: limit,
  });
  if (error || !Array.isArray(data)) return [];
  return data as BestTime[];
}

export interface WindowHistogramCell {
  day_of_week: number;
  hour_slot: number;
  member_count: number;
}

export async function getWindowHistogram(
  supabase: SupabaseClient,
  clubId: string,
): Promise<WindowHistogramCell[]> {
  const { data, error } = await supabase.rpc("club_window_histogram", { p_club: clubId });
  if (error || !Array.isArray(data)) return [];
  return data as WindowHistogramCell[];
}
