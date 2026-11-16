/**
 * ClubSync shared constants.
 *
 * Day-of-week convention, used identically in the database and the UI:
 *   0 = Monday ... 6 = Sunday
 */

export const DAYS = [
  { index: 0, long: "Monday", short: "Mon", initial: "M" },
  { index: 1, long: "Tuesday", short: "Tue", initial: "T" },
  { index: 2, long: "Wednesday", short: "Wed", initial: "W" },
  { index: 3, long: "Thursday", short: "Thu", initial: "T" },
  { index: 4, long: "Friday", short: "Fri", initial: "F" },
  { index: 5, long: "Saturday", short: "Sat", initial: "S" },
  { index: 6, long: "Sunday", short: "Sun", initial: "S" },
] as const;

export type PeriodKey = "before_school" | "lunch" | "after_school" | "evening";

export const PERIODS: ReadonlyArray<{
  key: PeriodKey;
  label: string;
  short: string;
  typicalStart: string;
  typicalEnd: string;
  hint: string;
}> = [
  {
    key: "before_school",
    label: "Before School",
    short: "Before",
    typicalStart: "07:00",
    typicalEnd: "08:00",
    hint: "Early-bird meetings before first period",
  },
  {
    key: "lunch",
    label: "During Lunch",
    short: "Lunch",
    typicalStart: "11:30",
    typicalEnd: "12:30",
    hint: "Short sessions inside the lunch block",
  },
  {
    key: "after_school",
    label: "After School",
    short: "After",
    typicalStart: "15:15",
    typicalEnd: "17:00",
    hint: "The most common club meeting window",
  },
  {
    key: "evening",
    label: "Evening",
    short: "Evening",
    typicalStart: "18:30",
    typicalEnd: "20:30",
    hint: "Virtual calls or evening practice",
  },
] as const;

export const PERIOD_KEYS = PERIODS.map((p) => p.key);

export function periodLabel(key: string): string {
  return PERIODS.find((p) => p.key === key)?.label ?? key;
}

export function dayLabel(index: number, form: "long" | "short" = "long"): string {
  const day = DAYS[index];
  if (!day) return `Day ${index}`;
  return form === "long" ? day.long : day.short;
}

/**
 * ClubSync never collects an email address. Supabase Auth needs an identifier,
 * so we derive a synthetic one from the pseudonym. `.invalid` is reserved by
 * RFC 2606 precisely so that it can never resolve or receive mail — nothing
 * here is a real, reachable address.
 */
export const IDENTITY_DOMAIN = "clubsync.invalid";
export const MEMBER_EMAIL_SUFFIX = `@members.${IDENTITY_DOMAIN}`;
export const ADMIN_EMAIL_SUFFIX = `@admins.${IDENTITY_DOMAIN}`;

export function memberEmail(username: string): string {
  return `${username.trim().toLowerCase()}${MEMBER_EMAIL_SUFFIX}`;
}

export function adminEmail(handle: string): string {
  return `${handle.trim().toLowerCase()}${ADMIN_EMAIL_SUFFIX}`;
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const CLUB_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,15}$/;

export const MIN_PASSWORD_LENGTH = 10;

export type AppRole = "member" | "leader";
