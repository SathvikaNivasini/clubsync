import { asString, friendlyDbError, jsonError, jsonOk, readJson } from "@/lib/api";
import { PERIOD_KEYS } from "@/lib/constants";
import { clubMemberUserIds, pushConfigured, sendPushToUsers } from "@/lib/push";
import { supabaseServer } from "@/lib/supabase/server";

interface Body {
  clubId?: unknown;
  title?: unknown;
  description?: unknown;
  location?: unknown;
  date?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  periodHint?: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Publish a meeting. Leader-only; RLS enforces club ownership on the insert. */
export async function POST(request: Request) {
  const body = await readJson<Body>(request);
  if (!body) return jsonError("Expected a JSON body.");

  const clubId = asString(body.clubId, 64);
  const title = asString(body.title, 120).trim();
  const description = asString(body.description, 2000).trim();
  const location = asString(body.location, 160).trim();
  const date = asString(body.date, 10);
  const startsAt = asString(body.startsAt, 5);
  const endsAt = asString(body.endsAt, 5);
  const periodHint = asString(body.periodHint, 32);

  if (!clubId) return jsonError("Select a club.");
  if (title.length < 2) return jsonError("Give the meeting a title of at least 2 characters.");
  if (!DATE_RE.test(date)) return jsonError("Pick a valid date.");
  if (!TIME_RE.test(startsAt) || !TIME_RE.test(endsAt)) return jsonError("Pick valid start and end times.");
  if (endsAt <= startsAt) return jsonError("The end time has to be after the start time.");
  if (periodHint && !PERIOD_KEYS.includes(periodHint as never)) {
    return jsonError("That time period is not recognised.");
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in first.", 401);

  // Snapshot the availability estimate at publish time so the meeting record
  // keeps the number the leader actually saw.
  let estimatedAvailable: number | null = null;
  let estimatedTotal: number | null = null;
  const { data: estimate } = await supabase.rpc("club_slot_estimate", {
    p_club: clubId,
    p_date: date,
    p_period: periodHint || null,
    p_starts: startsAt,
    p_ends: endsAt,
  });
  const estimateRow = Array.isArray(estimate) ? estimate[0] : estimate;
  if (estimateRow) {
    estimatedAvailable = estimateRow.combined_members as number;
    estimatedTotal = estimateRow.total_members as number;
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      club_id: clubId,
      title,
      description: description || null,
      location: location || null,
      meeting_date: date,
      starts_at: startsAt,
      ends_at: endsAt,
      period_hint: periodHint || null,
      estimated_available: estimatedAvailable,
      estimated_total: estimatedTotal,
      created_by: user.id,
    })
    .select("*, clubs(name)")
    .single();

  if (error || !meeting) {
    console.error("[clubsync] meeting insert failed:", error?.message);
    return jsonError(friendlyDbError(error), 403);
  }

  // In-app notifications were already written by the database trigger.
  // Web Push is best-effort on top of that.
  const clubName = (meeting as { clubs?: { name?: string } }).clubs?.name ?? "Your club";
  const push = pushConfigured()
    ? await sendPushToUsers(await clubMemberUserIds(clubId), {
        title: `${clubName}: new meeting`,
        body: `${title} — ${date} at ${startsAt}${location ? ` · ${location}` : ""}`,
        url: "/calendar",
        tag: `meeting-${meeting.id}`,
        kind: "meeting_scheduled",
      })
    : null;

  return jsonOk(
    {
      meetingId: meeting.id as string,
      estimatedAvailable,
      estimatedTotal,
      push: push ?? { configured: false },
    },
    201,
  );
}
