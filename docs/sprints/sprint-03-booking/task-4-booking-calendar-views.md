# Task 3.4 — Booking Calendar Views

**Sprint:** 3 — Booking & Scheduling
**Estimate:** 2 days

## Goal

Upcoming / Past / Cancelled views for both students and tutors, per PRD §6.1.C.

## Scope

- `GET /bookings?status=upcoming|past|cancelled` (or equivalent derived filtering by date + status) for the authenticated user, scoped to their role (student sees their bookings, tutor sees theirs).
- Mobile + web calendar/list views: Upcoming (accepted/confirmed, future), Past (completed or past-dated), Cancelled (declined/cancelled/expired).
- Booking detail view (tap into a booking from any list) showing full details, current status, and available actions (cancel, reschedule, message — chat wired once [Sprint 4](../sprint-04-messaging/README.md) lands).
- Empty states for each tab.

## Acceptance Criteria

- [ ] Upcoming/Past/Cancelled tabs correctly bucket bookings by status and date for both roles.
- [ ] Booking detail view shows accurate status and role-appropriate actions.
- [ ] Empty states render correctly for a user with no bookings in a given category.
- [ ] Pagination or reasonable limits applied for users with a large booking history.

## Technical Notes

- Keep bucketing logic (what counts as "upcoming" vs "past") in one shared place (`packages/shared` or a single backend query) so mobile and web never disagree on classification.

## Dependencies

- [Task 3.3 — Booking Accept / Decline / Counter-Propose](task-3-booking-accept-decline-counter.md)
