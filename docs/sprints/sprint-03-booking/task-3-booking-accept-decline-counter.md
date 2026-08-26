# Task 3.3 — Booking Accept / Decline / Counter-Propose

**Sprint:** 3 — Booking & Scheduling
**Estimate:** 2 days

## Goal

Give the tutor the three response options named in PRD §6.1.C ("Tutor accepts / declines / proposes alternative").

## Scope

- `PATCH /bookings/:id/accept`: moves `REQUESTED` → `ACCEPTED` (payment, added in [Sprint 5](../sprint-05-payments/README.md), later moves this to `CONFIRMED`).
- `PATCH /bookings/:id/decline`: moves `REQUESTED` → `DECLINED`, releases the held slot.
- `PATCH /bookings/:id/counter-propose`: tutor suggests an alternate time/slot; student can accept (proceeds as normal) or decline (booking ends as `DECLINED`).
- State transition guards: only valid transitions are allowed (e.g. can't accept an already-declined booking); enforced server-side, not just in UI.
- Triggers the notification flow from [Task 3.6](task-6-notification-integration.md) on every state change.

## Acceptance Criteria

- [ ] Tutor can accept, decline, or counter-propose from a `REQUESTED` booking; invalid transitions are rejected with a clear error.
- [ ] Counter-propose creates a clear round-trip: student can accept the new time (booking proceeds) or decline (booking ends).
- [ ] Every state transition fires the appropriate notification.
- [ ] State transitions are logged/auditable (who changed what, when) for later dispute handling in [Sprint 5](../sprint-05-payments/task-6-refund-dispute-handling.md) and [Sprint 7](../sprint-07-admin-panel/task-5-dispute-resolution-tools.md).

## Technical Notes

- Model the state machine explicitly (e.g. a small state-transition table/function) rather than scattering `if` checks across controller methods — this sprint's states get referenced again by cancellation ([Task 3.5](task-5-reschedule-cancellation-rules.md)), payments, and disputes later.

## Dependencies

- [Task 3.2 — Booking Request Flow (Backend)](task-2-booking-request-flow.md)
