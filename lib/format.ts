import { DAYS } from "./constants";

/** "15:15:00" | "15:15" -> "3:15 PM" */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw ?? 0);
  if (!Number.isFinite(h)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** Parse a "YYYY-MM-DD" date without letting the local timezone shift the day. */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(
  value: string,
  style: "long" | "medium" | "short" = "medium",
): string {
  const date = parseDateOnly(value);
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      : style === "short"
        ? { month: "short", day: "numeric" }
        : { weekday: "short", month: "short", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** 0 = Monday ... 6 = Sunday, matching the database convention. */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function dayName(date: Date): string {
  return DAYS[mondayIndex(date)].long;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date): Date {
  return addDays(date, -mondayIndex(date));
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isPastDate(value: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseDateOnly(value).getTime() < today.getTime();
}

/** Minutes between two "HH:MM" strings. */
export function durationMinutes(start: string, end: string): number {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  return toMinutes(end) - toMinutes(start);
}

export function formatDuration(start: string, end: string): string {
  const total = durationMinutes(start, end);
  if (total <= 0) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

/**
 * The next calendar date matching a weekday index, at least `minDays` away.
 * Used to turn "Thursday after school" into a concrete date for the scheduler.
 */
export function nextDateForDay(dayIndex: number, minDays = 1): string {
  const today = new Date();
  for (let offset = minDays; offset < minDays + 14; offset += 1) {
    const candidate = addDays(today, offset);
    if (mondayIndex(candidate) === dayIndex) return toDateOnly(candidate);
  }
  return toDateOnly(addDays(today, minDays));
}
