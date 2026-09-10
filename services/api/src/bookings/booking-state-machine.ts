import { BookingStatus } from "@prisma/client";

export type BookingActor = "TUTOR" | "STUDENT";
export type BookingResponseAction =
  | "accept"
  | "decline"
  | "counter-propose"
  | "reschedule-propose"
  | "reschedule-accept"
  | "reschedule-decline"
  | "cancel";

interface Transition {
  from: BookingStatus;
  action: BookingResponseAction;
  actor: BookingActor;
  to: BookingStatus;
}

// Statuses in which a booking still genuinely holds a slot and can be
// cancelled by either participant (Task 3.5). CONFIRMED (Task 5.2) is
// included too - a paid booking can still be cancelled; that does *not*
// auto-refund (PRD frames refunds as admin-mediated, Task 5.6) - the
// student or tutor raises a Dispute if a refund is warranted.
const CANCELLABLE_FROM: BookingStatus[] = [
  "REQUESTED",
  "COUNTER_PROPOSED",
  "ACCEPTED",
  "RESCHEDULE_PROPOSED",
  "CONFIRMED",
];

// Explicit table rather than scattered `if` checks - referenced again by
// cancellation (Task 3.5) and disputes (Sprint 5/7), so every legal move
// lives in one place.
const TRANSITIONS: Transition[] = [
  { from: "REQUESTED", action: "accept", actor: "TUTOR", to: "ACCEPTED" },
  { from: "REQUESTED", action: "decline", actor: "TUTOR", to: "DECLINED" },
  { from: "REQUESTED", action: "counter-propose", actor: "TUTOR", to: "COUNTER_PROPOSED" },
  { from: "COUNTER_PROPOSED", action: "accept", actor: "STUDENT", to: "ACCEPTED" },
  { from: "COUNTER_PROPOSED", action: "decline", actor: "STUDENT", to: "DECLINED" },

  // Either party can propose rescheduling an already-accepted booking; the
  // *other* party (enforced in BookingsService, not here - this table has
  // no notion of "who proposed this particular instance") must accept or
  // decline it. Declining just falls back to ACCEPTED at the original time.
  { from: "ACCEPTED", action: "reschedule-propose", actor: "TUTOR", to: "RESCHEDULE_PROPOSED" },
  { from: "ACCEPTED", action: "reschedule-propose", actor: "STUDENT", to: "RESCHEDULE_PROPOSED" },
  { from: "RESCHEDULE_PROPOSED", action: "reschedule-accept", actor: "TUTOR", to: "ACCEPTED" },
  { from: "RESCHEDULE_PROPOSED", action: "reschedule-accept", actor: "STUDENT", to: "ACCEPTED" },
  { from: "RESCHEDULE_PROPOSED", action: "reschedule-decline", actor: "TUTOR", to: "ACCEPTED" },
  { from: "RESCHEDULE_PROPOSED", action: "reschedule-decline", actor: "STUDENT", to: "ACCEPTED" },

  ...CANCELLABLE_FROM.flatMap(
    (from): Transition[] => [
      { from, action: "cancel", actor: "TUTOR", to: "CANCELLED" },
      { from, action: "cancel", actor: "STUDENT", to: "CANCELLED" },
    ],
  ),

  // Tutors may cancel a completed past session so it shows as cancelled
  // (red) on calendars; students cannot reverse a completed session.
  { from: "COMPLETED", action: "cancel", actor: "TUTOR", to: "CANCELLED" },
];

export function resolveBookingTransition(
  from: BookingStatus,
  action: BookingResponseAction,
  actor: BookingActor,
): BookingStatus | null {
  const match = TRANSITIONS.find(
    (t) => t.from === from && t.action === action && t.actor === actor,
  );
  return match ? match.to : null;
}
