import { redirect } from "next/navigation";

import { supabaseServer } from "./supabase/server";
import type { Role } from "./slots";

export interface Viewer {
  userId: string;
  role: Role;
  name: string;
  supabase: Awaited<ReturnType<typeof supabaseServer>>;
}

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.user_metadata as { app_role?: string; handle?: string } | undefined;
  const role = meta?.app_role;
  if (role !== "sponsor" && role !== "officer" && role !== "student") return null;

  return { userId: user.id, role, name: meta?.handle ?? "", supabase };
}

export function homeFor(role: Role): string {
  return role === "sponsor" ? "/sponsor" : role === "officer" ? "/officer" : "/student";
}

export async function requireRole(role: Role): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== role) redirect(homeFor(viewer.role));
  return viewer;
}
