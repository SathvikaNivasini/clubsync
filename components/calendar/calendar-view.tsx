"use client";

import { useMemo, useState } from "react";

import { MeetingCard, type MeetingWithClub } from "./meeting-card";
import { ClubDot } from "@/components/ui/club-dot";
import { EmptyState } from "@/components/ui/empty-state";
import { IconCalendar } from "@/components/ui/icons";
import {
  addDays,
  formatDate,
  formatTimeRange,
  isSameDay,
  startOfMonth,
  startOfWeek,
  toDateOnly,
} from "@/lib/format";

type View = "month" | "week" | "day";

const VIEWS: Array<{ key: View; label: string }> = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
];

const WEEKDAY_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({
  meetings,
  clubs,
  heading,
}: {
  meetings: MeetingWithClub[];
  clubs: Array<{ id: string; name: string; color: string }>;
  heading: string;
}) {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, MeetingWithClub[]>();
    for (const meeting of meetings) {
      const list = map.get(meeting.meeting_date) ?? [];
      list.push(meeting);
      map.set(meeting.meeting_date, list);
    }
    return map;
  }, [meetings]);

  const today = new Date();
  const upcoming = useMemo(() => {
    const todayKey = toDateOnly(new Date());
    return meetings
      .filter((m) => m.meeting_date >= todayKey && m.status === "scheduled")
      .slice(0, 6);
  }, [meetings]);

  function shift(direction: number) {
    if (view === "month") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1));
    } else if (view === "week") {
      setCursor(addDays(cursor, direction * 7));
    } else {
      setCursor(addDays(cursor, direction));
    }
    setSelected(null);
  }

  const periodLabel =
    view === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "week"
        ? (() => {
            const start = startOfWeek(cursor);
            const end = addDays(start, 6);
            return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
          })()
        : cursor.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });

  // Month grid: always six rows, starting on the Monday of the first week.
  const monthCells = useMemo(() => {
    const first = startOfMonth(cursor);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  const weekCells = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const selectedMeetings = selected ? (byDate.get(selected) ?? []) : [];
  const dayMeetings = byDate.get(toDateOnly(cursor)) ?? [];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous"
            className="cs-btn cs-btn-ghost px-2.5 py-1.5 text-sm"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              setCursor(new Date());
              setSelected(null);
            }}
            className="cs-btn cs-btn-ghost px-3 py-1.5 text-sm"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next"
            className="cs-btn cs-btn-ghost px-2.5 py-1.5 text-sm"
          >
            ›
          </button>
          <p className="ml-2 text-sm font-bold text-ink sm:text-base" aria-live="polite">
            {periodLabel}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Calendar view"
          className="flex gap-1 rounded-lg border border-line bg-canvas-deep p-1"
        >
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              type="button"
              aria-selected={view === v.key}
              onClick={() => {
                setView(v.key);
                setSelected(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === v.key ? "bg-surface-raised text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Club key — colour is never the only cue, names are always present */}
      {clubs.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {clubs.map((club) => (
            <li key={club.id} className="flex items-center gap-1.5 text-xs text-muted">
              <ClubDot color={club.color} size={7} />
              {club.name}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Month */}
      {view === "month" ? (
        <div className="cs-card overflow-hidden p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_HEADS.map((d) => (
              <span
                key={d}
                className="pb-1 text-center text-[0.625rem] font-bold uppercase tracking-wide text-muted"
              >
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{d[0]}</span>
              </span>
            ))}
            {monthCells.map((date) => {
              const key = toDateOnly(date);
              const dayMeetingList = byDate.get(key) ?? [];
              const inMonth = date.getMonth() === cursor.getMonth();
              const isToday = isSameDay(date, today);
              const isSelected = selected === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : key)}
                  aria-label={`${formatDate(key, "long")}, ${dayMeetingList.length} meeting(s)`}
                  aria-pressed={isSelected}
                  className={`flex min-h-[3.5rem] flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-[4.75rem] ${
                    isSelected
                      ? "border-primary bg-primary-soft"
                      : "border-transparent hover:border-line hover:bg-surface-hover"
                  } ${inMonth ? "" : "opacity-40"}`}
                >
                  <span
                    className={`cs-numeric text-xs font-bold ${
                      isToday
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[#2a1c05]"
                        : "text-muted"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {dayMeetingList.slice(0, 3).map((m) => (
                      <span
                        key={m.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            m.status === "cancelled" ? "var(--color-line-strong)" : m.clubColor,
                        }}
                      />
                    ))}
                    {dayMeetingList.length > 3 ? (
                      <span className="cs-numeric text-[0.5625rem] text-muted-dim">
                        +{dayMeetingList.length - 3}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Week */}
      {view === "week" ? (
        <div className="grid gap-2 sm:grid-cols-7">
          {weekCells.map((date) => {
            const key = toDateOnly(date);
            const list = byDate.get(key) ?? [];
            const isToday = isSameDay(date, today);
            return (
              <div
                key={key}
                className={`cs-card min-h-[7rem] space-y-2 p-2.5 ${
                  isToday ? "border-primary" : ""
                }`}
              >
                <p className="text-[0.625rem] font-bold uppercase tracking-wide text-muted">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}{" "}
                  <span className="cs-numeric text-ink">{date.getDate()}</span>
                </p>
                {list.length === 0 ? (
                  <p className="text-[0.6875rem] text-muted-dim">—</p>
                ) : (
                  list.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-md border-l-2 bg-canvas-deep px-2 py-1.5"
                      style={{
                        borderColor: m.status === "cancelled" ? "var(--color-line-strong)" : m.clubColor,
                      }}
                    >
                      <p
                        className={`truncate text-[0.6875rem] font-bold text-ink ${
                          m.status === "cancelled" ? "line-through" : ""
                        }`}
                      >
                        {m.title}
                      </p>
                      <p className="cs-numeric text-[0.625rem] text-muted">
                        {formatTimeRange(m.starts_at, m.ends_at)}
                      </p>
                      <p className="truncate text-[0.625rem] text-muted-dim">{m.clubName}</p>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Day */}
      {view === "day" ? (
        <div className="space-y-3">
          {dayMeetings.length === 0 ? (
            <EmptyState
              icon={<IconCalendar size={20} />}
              title="Nothing scheduled on this day"
              description="Use the arrows to move to another day, or switch to the month view to see where meetings land."
            />
          ) : (
            dayMeetings.map((m) => <MeetingCard key={m.id} meeting={m} />)
          )}
        </div>
      ) : null}

      {/* Selected day detail (month view) */}
      {view === "month" && selected ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-ink">{formatDate(selected, "long")}</h2>
          {selectedMeetings.length === 0 ? (
            <p className="text-sm text-muted">No meetings on this day.</p>
          ) : (
            selectedMeetings.map((m) => <MeetingCard key={m.id} meeting={m} />)
          )}
        </section>
      ) : null}

      {/* Upcoming list — always available regardless of view */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-ink">{heading}</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<IconCalendar size={20} />}
            title="No upcoming meetings"
            description="When a leader publishes a meeting it appears here and you get a notification."
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map((m) => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
