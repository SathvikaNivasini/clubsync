export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseISO(v: string): Date {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
/** Monday-first grid start for the month containing `d`. */
export function gridStart(d: Date): Date {
  const first = startOfMonth(d);
  return addDays(first, -((first.getDay() + 6) % 7));
}
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function isPast(dateISO: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseISO(dateISO).getTime() < today.getTime();
}
export function pretty(dateISO: string): string {
  return parseISO(dateISO).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
export function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
/** "in 2 days", "in 3 hours", "closed" */
export function countdown(deadlineISO: string): string {
  const ms = new Date(deadlineISO).getTime() - Date.now();
  if (ms <= 0) return "closed";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min left`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr left`;
  return `${Math.round(hrs / 24)} days left`;
}
