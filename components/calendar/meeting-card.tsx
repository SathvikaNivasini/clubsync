import { ClubDot } from "@/components/ui/club-dot";
import { IconClock, IconPin, IconUsers } from "@/components/ui/icons";
import { formatDate, formatDuration, formatTimeRange, isPastDate } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export interface MeetingWithClub extends Meeting {
  clubName: string;
  clubColor: string;
}

export function MeetingCard({
  meeting,
  showClub = true,
  showEstimate = false,
  actions,
}: {
  meeting: MeetingWithClub;
  showClub?: boolean;
  showEstimate?: boolean;
  actions?: React.ReactNode;
}) {
  const cancelled = meeting.status === "cancelled";
  const past = isPastDate(meeting.meeting_date);

  return (
    <article
      className={`cs-card relative overflow-hidden p-4 transition-opacity sm:p-5 ${
        cancelled ? "opacity-70" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: cancelled ? "var(--color-line-strong)" : meeting.clubColor }}
      />

      <div className="flex flex-wrap items-start justify-between gap-3 pl-1.5">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {showClub ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
                <ClubDot color={meeting.clubColor} size={7} />
                {meeting.clubName}
              </span>
            ) : null}
            {cancelled ? (
              <span className="cs-pill border-[#f2635c59] bg-danger-soft text-danger">Cancelled</span>
            ) : past ? (
              <span className="cs-pill">Past</span>
            ) : null}
          </div>

          <h3
            className={`text-base font-bold tracking-tight text-ink ${
              cancelled ? "line-through decoration-muted-dim" : ""
            }`}
          >
            {meeting.title}
          </h3>

          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Date</dt>
              <dd className="font-medium text-ink">{formatDate(meeting.meeting_date, "medium")}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <IconClock size={14} className="text-muted-dim" />
              <dt className="sr-only">Time</dt>
              <dd>
                {formatTimeRange(meeting.starts_at, meeting.ends_at)}
                <span className="text-muted-dim">
                  {" "}
                  · {formatDuration(meeting.starts_at, meeting.ends_at)}
                </span>
              </dd>
            </div>
            {meeting.location ? (
              <div className="flex items-center gap-1.5">
                <IconPin size={14} className="text-muted-dim" />
                <dt className="sr-only">Location</dt>
                <dd>{meeting.location}</dd>
              </div>
            ) : null}
          </dl>

          {meeting.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
              {meeting.description}
            </p>
          ) : null}

          {cancelled && meeting.cancellation_reason ? (
            <p className="text-sm text-danger">Reason: {meeting.cancellation_reason}</p>
          ) : null}

          {showEstimate && meeting.estimated_available !== null ? (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
              <IconUsers size={13} className="mt-0.5 shrink-0 text-muted-dim" />
              <span>
                <strong className="font-semibold text-ink">
                  {meeting.estimated_available}
                  {meeting.estimated_total !== null ? ` of ${meeting.estimated_total}` : ""}
                </strong>{" "}
                members said they were free at this time when it was published — an availability
                estimate, not a confirmed attendance list.
              </span>
            </p>
          ) : null}
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </article>
  );
}
