import type { PeriodKey } from "./constants";

export type MeetingStatus = "scheduled" | "cancelled" | "completed";

export type NotificationKind =
  | "meeting_scheduled"
  | "meeting_updated"
  | "meeting_cancelled"
  | "meeting_reminder"
  | "club_joined"
  | "system";

export interface Club {
  id: string;
  code: string;
  name: string;
  description: string | null;
  school: string | null;
  accent_color: string;
  timezone: string;
  join_enabled: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClubAdmin {
  id: string;
  club_id: string;
  user_id: string;
  admin_handle: string;
  display_name: string | null;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface Member {
  id: string;
  username: string;
  recovery_phrase_set_at: string | null;
  notifications_enabled: boolean;
  reminder_lead_minutes: number;
  created_at: string;
}

export interface Membership {
  id: string;
  club_id: string;
  member_id: string;
  member_number: number;
  joined_at: string;
}

export interface AvailabilitySlot {
  id?: string;
  club_id: string;
  member_id?: string;
  day_of_week: number;
  period: PeriodKey;
}

export interface AvailabilityWindow {
  id?: string;
  club_id: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
}

export interface AvailabilityStatus {
  club_id: string;
  member_id: string;
  slot_count: number;
  window_count: number;
  updated_at: string;
}

export interface Meeting {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  location: string | null;
  meeting_date: string;
  starts_at: string;
  ends_at: string;
  period_hint: PeriodKey | null;
  status: MeetingStatus;
  estimated_available: number | null;
  estimated_total: number | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  member_id: string;
  club_id: string | null;
  meeting_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

/* ----- RPC shapes ----- */

export interface ClubOverview {
  total_members: number;
  submitted_count: number;
  pending_count: number;
  upcoming_meetings: number;
  submission_rate: number;
  last_submission_at: string | null;
}

export interface MatrixCell {
  day_of_week: number;
  period: PeriodKey;
  period_label: string;
  member_count: number;
  pct: number;
}

export interface DayTotal {
  day_of_week: number;
  member_count: number;
  pct: number;
}

export interface PeriodTotal {
  period: PeriodKey;
  period_label: string;
  member_count: number;
  pct: number;
}

export interface BestTime {
  rank: number;
  day_of_week: number;
  period: PeriodKey;
  period_label: string;
  typical_start: string;
  typical_end: string;
  member_count: number;
  total_members: number;
  pct: number;
}

export interface SlotEstimate {
  day_of_week: number;
  period_members: number;
  window_members: number;
  combined_members: number;
  total_members: number;
  pct: number;
}

export interface ClubLookup {
  id: string;
  code: string;
  name: string;
  description: string | null;
  school: string | null;
  accent_color: string;
  member_count: number;
  already_member: boolean;
}

/** A club as a member sees it, with their own submission state attached. */
export interface MemberClubView {
  club: Club;
  memberNumber: number;
  slotCount: number;
  windowCount: number;
  lastUpdated: string | null;
}
