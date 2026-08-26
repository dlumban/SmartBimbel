# Task 3.1 — Tutor Availability Management

**Sprint:** 3 — Booking & Scheduling
**Estimate:** 3 days

## Goal

Full availability management, replacing the lightweight version captured during [Sprint 1 onboarding](../sprint-01-auth-onboarding/task-5-tutor-profile-completion.md), per PRD §6.1.C ("Tutor can set recurring or one-off availability slots").

## Scope

- `POST/PATCH/DELETE /tutors/me/availability`: recurring weekly slots (e.g. "every Tuesday 16:00–18:00") and one-off date-specific slots.
- Conflict detection: prevent overlapping slots for the same tutor.
- Slot state: a slot is either open or held/booked — once a booking request occupies it (per [Task 3.2](task-2-booking-request-flow.md)), it's no longer offered to other students.
- Tutor-facing calendar UI to add/edit/remove availability (mobile + web).
- Timezone handling: store in UTC, display in WIB/WITA/WIT per tutor's registered city (Indonesia spans three timezones).

## Acceptance Criteria

- [ ] Tutor can create recurring weekly availability and one-off slots without overlap conflicts.
- [ ] A slot occupied by a pending or confirmed booking is no longer offered as available to other students.
- [ ] Deleting/editing a slot that has an active booking against it is blocked or requires explicit confirmation (can't silently orphan a booking).
- [ ] Availability displays correctly across Indonesia's three timezones for tutors registered in different regions.

## Technical Notes

- This extends, not replaces, the `AvailabilitySlot` model from [Task 0.4](../sprint-00-foundation/task-4-database-schema.md) — add recurrence fields (`rrule`-style or a simpler day-of-week + time-range representation) as needed.

## Dependencies

- Sprint 0: [Database Schema](../sprint-00-foundation/task-4-database-schema.md)
- Sprint 1: [Tutor Multi-Step Profile Completion](../sprint-01-auth-onboarding/task-5-tutor-profile-completion.md)
