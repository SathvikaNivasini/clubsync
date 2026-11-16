import { jsonError, jsonOk } from "@/lib/api";
import { pushConfigured, sendPushToUsers } from "@/lib/push";
import { hasAdminCredentials, supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Meeting reminders.
 *
 * This endpoint is the scheduled half of notifications: it finds meetings that
 * start inside each member's reminder window, writes one reminder row per
 * member (a partial unique index makes that idempotent) and pushes it.
 *
 * It needs an external scheduler to call it — a Vercel Cron entry, a GitHub
 * Action, or pg_cron. See README.md. Nothing reminds anyone until that is set
 * up, and the UI says so rather than implying reminders are already running.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return jsonError("Reminders are disabled: CRON_SECRET is not set on the server.", 503);
  }

  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret") ??
    "";
  if (provided !== secret) return jsonError("Not authorised.", 401);

  if (!hasAdminCredentials()) return jsonError("Server is missing its service role key.", 503);

  const admin = supabaseAdmin();
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: meetings, error } = await admin
    .from("meetings")
    .select("id, club_id, title, location, meeting_date, starts_at, clubs(name)")
    .eq("status", "scheduled")
    .gte("meeting_date", now.toISOString().slice(0, 10))
    .lte("meeting_date", horizon.toISOString().slice(0, 10));

  if (error) {
    console.error("[clubsync] reminder scan failed:", error.message);
    return jsonError("Could not scan for upcoming meetings.", 500);
  }

  let remindersWritten = 0;
  let pushed = 0;
  const considered = meetings?.length ?? 0;

  for (const meeting of meetings ?? []) {
    const startsAt = new Date(`${meeting.meeting_date}T${meeting.starts_at}`);
    const minutesAway = (startsAt.getTime() - now.getTime()) / 60000;
    if (minutesAway < 0) continue;

    const { data: members } = await admin
      .from("club_memberships")
      .select("member_id, members!inner(reminder_lead_minutes, notifications_enabled)")
      .eq("club_id", meeting.club_id);

    const due = (members ?? []).filter((row) => {
      const m = (row as unknown as { members: { reminder_lead_minutes: number; notifications_enabled: boolean } })
        .members;
      return m?.notifications_enabled !== false && minutesAway <= m.reminder_lead_minutes;
    });
    if (due.length === 0) continue;

    const clubName = (meeting as { clubs?: { name?: string } }).clubs?.name ?? "Your club";
    const title = `${clubName}: starting soon`;
    const body = `${meeting.title} starts at ${meeting.starts_at}${
      meeting.location ? ` · ${meeting.location}` : ""
    }`;

    const { data: inserted } = await admin
      .from("notifications")
      .upsert(
        due.map((row) => ({
          member_id: (row as { member_id: string }).member_id,
          club_id: meeting.club_id,
          meeting_id: meeting.id,
          kind: "meeting_reminder" as const,
          title: title.slice(0, 160),
          body: body.slice(0, 600),
        })),
        { onConflict: "member_id,meeting_id,kind", ignoreDuplicates: true },
      )
      .select("member_id");

    const freshIds = (inserted ?? []).map((row) => (row as { member_id: string }).member_id);
    remindersWritten += freshIds.length;

    if (freshIds.length > 0 && pushConfigured()) {
      const result = await sendPushToUsers(freshIds, {
        title,
        body,
        url: "/calendar",
        tag: `reminder-${meeting.id}`,
        kind: "meeting_reminder",
      });
      pushed += result.delivered;
    }
  }

  return jsonOk({ meetingsConsidered: considered, remindersWritten, pushDelivered: pushed });
}
