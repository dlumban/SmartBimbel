# Task 3.2 — Booking Request Flow (Backend)

**Sprint:** 3 — Booking & Scheduling
**Estimate:** 3 days

## Goal

The core `Booking` state machine and creation endpoint, matching PRD §6.1.C and the happy path in PRD §8.

## Scope

- `POST /bookings`: student submits date, time, duration (60/90/120 min), subject, mode (online/offline), and notes/goals against a specific tutor + availability slot. Creates `Booking` in `REQUESTED` state.
- Slot locking: the targeted `AvailabilitySlot` is held (not fully consumed) while `REQUESTED`, to prevent double-booking during the tutor's response window; released back to open if declined or expired.
- Booking expiry: if a tutor doesn't respond within a defined window (e.g. 24h), the request auto-expires and the slot reopens — define and implement this as a scheduled job (BullMQ).
- `GET /bookings/:id`, `GET /bookings` (filtered by role/status) for both sides.
- Validation: booking duration matches tutor's offered durations, mode matches tutor's supported modes, time falls within an actual open slot.

## Acceptance Criteria

- [ ] Submitting a valid booking request creates a `REQUESTED` booking and holds the targeted slot from other students.
- [ ] Two students cannot successfully book the same slot simultaneously (race condition covered by a test).
- [ ] An unanswered request auto-expires after the defined window and the slot reopens.
- [ ] Invalid requests (mismatched duration/mode, slot no longer available) are rejected with clear validation errors.

## Technical Notes

- Use a database transaction or row-level lock when creating a booking against a slot to prevent the double-booking race condition under concurrent requests.

## Dependencies

- [Task 3.1 — Tutor Availability Management](task-1-tutor-availability-management.md)
- Sprint 2: student must be able to reach a tutor's detail page to initiate this.
