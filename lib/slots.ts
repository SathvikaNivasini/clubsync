/** ClubSync has exactly two slots. Nothing else is ever offered or stored. */
export const SLOTS = [
  { key: "before_school", label: "Before school", short: "Before", time: "7:00 – 8:00", emoji: "🌅" },
  { key: "after_school", label: "After school", short: "After", time: "3:15 – 5:00", emoji: "🌇" },
] as const;

export type SlotKey = (typeof SLOTS)[number]["key"];

export function slotLabel(key: string): string {
  return SLOTS.find((s) => s.key === key)?.label ?? key;
}
export function slotShort(key: string): string {
  return SLOTS.find((s) => s.key === key)?.short ?? key;
}
export function slotTime(key: string): string {
  return SLOTS.find((s) => s.key === key)?.time ?? "";
}

export type Role = "sponsor" | "officer" | "student";

/** No email is ever collected; Supabase Auth needs an identifier, so we derive
 *  one. `.invalid` is reserved by RFC 2606 and can never receive mail. */
const DOMAIN = "clubsync.invalid";
export function loginEmail(handle: string, role: Role): string {
  const h = handle.trim().toLowerCase();
  if (role === "sponsor") return `${h}@sponsors.${DOMAIN}`;
  if (role === "officer") return `${h}@officers.${DOMAIN}`;
  return `${h}@members.${DOMAIN}`;
}

export const MIN_PASSWORD = 8;
