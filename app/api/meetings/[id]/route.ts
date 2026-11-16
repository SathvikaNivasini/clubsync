import { asString, friendlyDbError, jsonError, jsonOk, readJson } from "@/lib/api";
import { PERIOD_KEYS } from "@/lib/constants";
import { clubMemberUserIds, pushConfigured, sendPushToUsers } from "@/lib/push";
import { supabaseServer } from "@/lib/supabase/server";

interface Body {
  title?: unknown;
  description?: unknown;
  location?: unknown;
  date?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  periodHint?: unknown;
  status?: unknown;
  cancellationReason?: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Edit, reschedule or cancel a meeting. RLS restricts this to the club's leader. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await readJson<Body>(request);
  if (!body) return jsonError("Expected a JSON body.");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in first.", 401);

  const { data: current, error: loadError } = await supabase
    .from("meetings")
    .select("*, clubs(name)")
    .eq("id", id)
    .single();

  if (loadError || !current) return jsonError("That meeting no longer exists.", 404);

  const patch: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = asString(body.title, 120).trim();
    if (title.length < 2) return jsonError("Give the meeting a title of at least 2 characters.");
    patch.title = title;
  }
  if (body.description !== undefined) {
    patch.description = asString(body.description, 2000).trim() || null;
  }
  if (body.location !== undefined) {
    patch.location = asString(body.location, 160).trim() || null;
  }
  if (body.date !== undefined) {
    const date = asString(body.date, 10);
    if (!DATE_RE.test(date)) return jsonError("Pick a valid date.");
    patch.meeting_date = date;
  }
  if (body.startsAt !== undefined) {
    const startsAt = asString(body.startsAt, 5);
    if (!TIME_RE.test(startsAt)) return jsonError("Pick a valid start time.");
    patch.starts_at = startsAt;
  }
  if (body.endsAt !== undefined) {
    const endsAt = asString(body.endsAt, 5);
    if (!TIME_RE.test(endsAt)) return jsonError("Pick a valid end time.");
    patch.ends_at = endsAt;
  }
  if (body.periodHint !== undefined) {
    const hint = asString(body.periodHint, 32);
    if (hint && !PERIOD_KEYS.includes(hint as never)) return jsonError("Unknown time period.");
    patch.period_hint = hint || null;
  }
  if (body.status !== undefined) {
    const status = asString(body.status, 20);
    if (!["scheduled", "cancelled", "completed"].includes(status)) {
      return jsonError("Unknown meeting status.");
    }
    patch.status = status;
  }
  if (body.cancellationReason !== undefined) {
    patch.cancellation_reason = asString(body.cancellationReason, 400).trim() || null;
  }

  if (Object.keys(patch).length === 0) return jsonError("Nothing to change.");

  const nextStart = (patch.starts_at as string) ?? (current.starts_at as string);
  const nextEnd = (patch.ends_at as string) ?? (current.ends_at as string);
  if (nextEnd <= nextStart) return jsonError("The end time has to be after the start time.");

  const { data: updated, error } = await supabase
    .from("meetings")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !updated) {
    console.error("[clubsync] meeting update failed:", error?.message);
    return jsonError(friendlyDbError(error), 403);
  }

  const clubName = (current as { clubs?: { name?: string } }).clubs?.name ?? "Your club";
  const clubId = current.club_id as string;
  const cancelled = updated.status === "cancelled" && current.status !== "cancelled";

  const changedWhen =
    current.meeting_date !== updated.meeting_date ||
    current.starts_at !== updated.starts_at ||
    current.ends_at !== updated.ends_at ||
    (current.location ?? "") !== (updated.location ?? "") ||
    current.title !== updated.title;

  let push = null;
  if (pushConfigured() && (cancelled || changedWhen)) {
    push = await sendPushToUsers(await clubMemberUserIds(clubId), {
      title: cancelled ? `${clubName}: meeting cancelled` : `${clubName}: meeting updated`,
      body: cancelled
        ? `${updated.title} on ${updated.meeting_date} has been cancelled.`
        : `${updated.title} is now ${updated.meeting_date} at ${updated.starts_at}${
            updated.location ? ` · ${updated.location}` : ""
          }`,
      url: "/calendar",
      tag: `meeting-${id}`,
      kind: cancelled ? "meeting_cancelled" : "meeting_updated",
    });
  }

  return jsonOk({
    meetingId: id,
    status: updated.status as string,
    push: push ?? { configured: pushConfigured() },
  });
}

/**
 * Permanently remove a meeting. The UI only offers this for meetings that are
 * already cancelled, so members always get the cancellation notice first.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in first.", 401);

  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) {
    console.error("[clubsync] meeting delete failed:", error.message);
    return jsonError(friendlyDbError(error), 403);
  }
  return jsonOk({ deleted: true });
}
