# Task 3.7 — Booking Flow UI

**Sprint:** 3 — Booking & Scheduling
**Estimate:** 4 days

## Goal

Ship the screens that turn Tasks 3.1–3.6 into a usable booking experience on mobile and web.

## Scope

- Booking creation flow from a tutor's detail page ([Sprint 2, Task 2.4](../sprint-02-discovery/task-4-tutor-detail-page.md)): slot picker (from tutor's real availability), duration, subject, mode, notes — submits via [Task 3.2](task-2-booking-request-flow.md).
- Tutor-side request inbox: incoming requests with accept / decline / counter-propose actions.
- Student-side pending-request state: waiting, accepted, declined, or countered, with clear next actions.
- Calendar views from [Task 3.4](task-4-booking-calendar-views.md) implemented in UI.
- Cancel/reschedule UI from [Task 3.5](task-5-reschedule-cancellation-rules.md), showing the applicable policy (e.g. "free cancellation until [time]") before the user confirms.
- Push notification handling in-app (tapping a booking notification deep-links to the relevant booking).

## Acceptance Criteria

- [ ] A student can complete a full booking request from tutor profile to submitted request.
- [ ] A tutor can respond to a request (accept/decline/counter) from the request inbox.
- [ ] Cancellation UI clearly shows whether the cancellation is free or penalized before the user confirms.
- [ ] Tapping a booking-related push notification deep-links into the correct booking detail screen.
- [ ] All states from the backend state machine ([Task 3.3](task-3-booking-accept-decline-counter.md)) have a corresponding, non-broken UI state.

## Technical Notes

- This is the first sprint where mobile and web diverge meaningfully in interaction pattern (e.g. slot picker as a full-screen mobile flow vs. an inline web calendar) — keep the underlying API calls and state model shared via `packages/shared`, even if the visual layout differs.

## Dependencies

- [Task 3.2 — Booking Request Flow](task-2-booking-request-flow.md), [Task 3.3](task-3-booking-accept-decline-counter.md), [Task 3.4](task-4-booking-calendar-views.md), [Task 3.5](task-5-reschedule-cancellation-rules.md)
