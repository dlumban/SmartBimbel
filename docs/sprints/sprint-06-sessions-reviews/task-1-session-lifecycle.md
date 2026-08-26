# Task 6.1 — Session Lifecycle & "Mark Complete" Flow

**Sprint:** 6 — Session Management & Reviews
**Estimate:** 2 days

## Goal

Define and implement how a `CONFIRMED` booking becomes `COMPLETED`, per PRD §6.1.F.

## Scope

- `PATCH /bookings/:id/complete`: tutor marks a session complete after it occurs. Consider whether student confirmation is also required, or tutor-only marking is sufficient for MVP trust levels (product decision — document the choice).
- Fallback auto-completion: a scheduled job (BullMQ) that auto-marks sessions complete N hours after their scheduled end time if neither party acted, to avoid transactions stuck in limbo indefinitely.
- Role-specific dashboard views reflecting session status (PRD §6.1.F: "Role-specific dashboards") — surfaces today's/upcoming sessions prominently for both roles.
- Completing a session triggers: transaction eligibility for payout ([Sprint 5, Task 5.4](../sprint-05-payments/task-4-tutor-earnings-dashboard.md)) and the review prompt ([Task 6.4](task-4-ratings-reviews-system.md)).

## Acceptance Criteria

- [ ] A `CONFIRMED` booking can be marked complete by the tutor (and/or student, per the chosen policy) only after its scheduled time has passed.
- [ ] Sessions left unmarked auto-complete after the defined grace period.
- [ ] Completing a session correctly updates the associated `Transaction`'s payout eligibility.
- [ ] Dashboards clearly surface today's and upcoming sessions for both roles.

## Technical Notes

- Auto-completion prevents a silent failure mode where an inattentive tutor never marks sessions complete, permanently blocking their own payout eligibility and the student's ability to review — treat this as required, not optional.

## Dependencies

- Sprint 3: [Booking Accept / Decline / Counter-Propose](../sprint-03-booking/task-3-booking-accept-decline-counter.md) (state machine)
- Sprint 5: [Booking Payment Flow](../sprint-05-payments/task-2-booking-payment-flow.md) (`CONFIRMED` state)
