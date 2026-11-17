import { redirect } from "next/navigation";
import { supabaseServer, type AppSupabaseClient } from "./supabase/server";
import type { Club, ClubAdmin, Member, MemberClubView } from "./types";
import type { AppRole } from "./constants";

export interface MemberViewer {
  role: "member";
  userId: string;
  member: Member;
  supabase: AppSupabaseClient;
}

export interface LeaderViewer {
  role: "leader";
  userId: string;
  admin: ClubAdmin;
  club: Club;
  supabase: AppSupabaseClient;
}

export type Viewer = MemberViewer | LeaderViewer;

export function roleFromMetadata(metadata: unknown): AppRole | null {
  if (metadata && typeof metadata === "object" && "app_role" in metadata) {
    const value = (metadata as { app_role?: unknown }).app_role;
    if (value === "member" || value === "leader") return value;
  }
  return null;
}

/**
 * Resolve the signed-in user into either a member or a club leader.
 * Returns null when nobody is signed in.
 */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const hinted = roleFromMetadata(user.user_metadata);

  if (hinted !== "leader") {
    const { data: member } = await supabase
      .from("members")
      .select("id, username, recovery_phrase_set_at, notifications_enabled, reminder_lead_minutes, created_at")
      .eq("id", user.id)
      .maybeSingle();
    if (member) {
      return { role: "member", userId: user.id, member: member as Member, supabase };
    }
  }

  const { data: admin } = await supabase
    .from("club_admins")
    .select("*, clubs(*)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (admin) {
    const { clubs, ...rest } = admin as ClubAdmin & { clubs: Club };
    return { role: "leader", userId: user.id, admin: rest as ClubAdmin, club: clubs, supabase };
  }

  return null;
}

export async function requireMember(nextPath = "/dashboard"): Promise<MemberViewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (viewer.role !== "member") redirect("/leader");
  return viewer;
}

export async function requireLeader(): Promise<LeaderViewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?role=leader&next=%2Fleader");
  if (viewer.role !== "leader") redirect("/dashboard");
  return viewer;
}

/**
 * Every club the member belongs to, with their own submission state.
 * RLS restricts all three reads to the caller's own rows.
 */
export async function getMemberClubs(
  supabase: AppSupabaseClient,
  memberId: string,
): Promise<MemberClubView[]> {
  const { data: memberships, error } = await supabase
    .from("club_memberships")
    .select("club_id, member_number, joined_at, clubs(*)")
    .eq("member_id", memberId)
    .order("joined_at", { ascending: true });

  if (error || !memberships) return [];

  const { data: statuses } = await supabase
    .from("availability_status")
    .select("club_id, slot_count, window_count, updated_at")
    .eq("member_id", memberId);

  const statusByClub = new Map(
    (statuses ?? []).map((s) => [s.club_id as string, s]),
  );

  return (memberships as unknown as Array<{ club_id: string; member_number: number; clubs: Club }>)
    .filter((row) => row.clubs)
    .map((row) => {
      const status = statusByClub.get(row.club_id);
      return {
        club: row.clubs,
        memberNumber: row.member_number,
        slotCount: (status?.slot_count as number) ?? 0,
        windowCount: (status?.window_count as number) ?? 0,
        lastUpdated: (status?.updated_at as string) ?? null,
      };
    });
}
