/**
 * Booking statuses that mean a slot/tutor is genuinely occupied - used
 * anywhere something needs to know "is this booking still live" without
 * duplicating the list (Tasks 3.1 and 2.4 both need exactly this check).
 * Mirrors the BookingStatus enum in services/api/prisma/schema.prisma;
 * kept as plain strings here since Prisma's generated enum isn't
 * importable outside the API package.
 */
export const ACTIVE_BOOKING_STATUSES = [
  "REQUESTED",
  "COUNTER_PROPOSED",
  "ACCEPTED",
  "RESCHEDULE_PROPOSED",
  "CONFIRMED",
] as const;

export type ActiveBookingStatus = (typeof ACTIVE_BOOKING_STATUSES)[number];

// Terminal statuses where the booking is over without a completed session -
// grouped together for the "Cancelled" bucket in booking list views
// (Task 3.4). Distinct from COMPLETED, which is a successful terminal
// state.
export const CANCELLED_LIKE_BOOKING_STATUSES = ["DECLINED", "EXPIRED", "CANCELLED"] as const;

export type CancelledLikeBookingStatus = (typeof CANCELLED_LIKE_BOOKING_STATUSES)[number];

export type BookingListBucket = "upcoming" | "past" | "cancelled";

// Confirmed with the product stakeholder (PRD §14 flagged this as an open
// question, "12-24 hours" as an example) - Task 3.5. Shared so the web
// cancellation UI can preview "free" vs. "late" before the user confirms
// without duplicating (and risking drifting from) the backend's own rule.
export const FREE_CANCELLATION_WINDOW_HOURS = 24;

// A session is one or more consecutive 30-minute slots (Task: calendar
// scheduling), capped at 4 hours - not a hard business requirement, just
// a sane upper bound against fat-fingered input.
export const ALLOWED_BOOKING_DURATIONS_MINUTES = [30, 60, 90, 120, 150, 180, 210, 240] as const;

// Product decision (Task 6.1's own note: "document the choice") - a tutor
// gets a full day after the session ends to mark it complete themselves
// before the auto-complete safety net does it for them, so a transaction
// is never stuck in limbo indefinitely (and never blocks payout
// eligibility or the student's ability to review) just because a busy
// tutor forgot to tap one button.
export const SESSION_AUTO_COMPLETE_GRACE_HOURS = 24;

// Product decision (Task 6.4's own note: "editable within a short window
// (e.g. 24-48h) then locked") - 48h from the review's original creation.
export const REVIEW_EDIT_WINDOW_HOURS = 48;

// "Gabung Sesi" is highlighted (not just always-on) starting this many
// minutes before the session's scheduled start (Task 6.2's "time-aware"
// requirement) - it's always clickable once a link exists, but gets a more
// prominent style as the session approaches.
export const JOIN_MEETING_HIGHLIGHT_MINUTES_BEFORE = 10;

export type AllowedBookingDurationMinutes = (typeof ALLOWED_BOOKING_DURATIONS_MINUTES)[number];

// PRD §6.1.D: meeting links must be Zoom or Google Meet (MVP uses external
// video tools, not in-app video - PRD §9). Shared so the web chat/booking
// UI can validate inline before submitting, using the exact same rule the
// backend enforces (Task 4.3).
export function isValidMeetingLink(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return host === "zoom.us" || host.endsWith(".zoom.us") || host === "meet.google.com";
}

