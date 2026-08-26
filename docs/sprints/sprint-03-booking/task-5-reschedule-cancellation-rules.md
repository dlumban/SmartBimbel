# Task 3.5 — Reschedule & Cancellation Rules Engine

**Sprint:** 3 — Booking & Scheduling
**Estimate:** 2 days

## Goal

Implement enforceable reschedule/cancellation policy per PRD §6.1.C (e.g. free cancellation ≥ 12–24 hours before session), not just a written policy.

## Scope

- Finalize the actual policy thresholds (product decision — PRD flags "12–24 hours" as an example, not a final number; confirm with stakeholder before implementation, see PRD §14 open question on cancellation policy).
- `PATCH /bookings/:id/cancel`: computes whether the cancellation is within the free window; if not, flags for a fee/penalty (fee mechanics settle with [Sprint 5](../sprint-05-payments/README.md) once payment exists — for a pre-payment booking, this may simply be a reputation/strike record for MVP).
- `PATCH /bookings/:id/reschedule`: either party proposes a new time against the tutor's availability; requires the other party's acceptance (reuses the accept/decline pattern from [Task 3.3](task-3-booking-accept-decline-counter.md)).
- Cancellation reason capture (dropdown + optional free text) for later analytics and dispute context.
- No-show handling: a lightweight flag either side can raise if the other didn't show, feeding into [Sprint 7](../sprint-07-admin-panel/README.md)'s dispute tools later.

## Acceptance Criteria

- [ ] Cancelling within the free window incurs no penalty; cancelling after it is flagged accordingly.
- [ ] Reschedule requires mutual agreement — a unilateral time change is never silently applied.
- [ ] Cancellation reason is captured and stored on the booking record.
- [ ] No-show flag is recorded and visible to admin tooling once it exists.

## Technical Notes

- Since payment isn't wired until [Sprint 5](../sprint-05-payments/README.md), late-cancellation "penalties" in this sprint are recorded as data (for future enforcement), not yet charged — don't build premature payment-adjacent logic here.

## Dependencies

- [Task 3.3 — Booking Accept / Decline / Counter-Propose](task-3-booking-accept-decline-counter.md)
