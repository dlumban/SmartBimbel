# Sprint 3 — Booking & Scheduling

**Duration:** 2 weeks
**PRD reference:** §6.1.C

## Goal

Turn a tutor profile view into a real booking: availability, request/accept/decline, calendar views, reschedule/cancel rules, and notifications — the core transaction mechanic the whole platform exists to support.

## Scope

1. [Tutor Availability Management](task-1-tutor-availability-management.md)
2. [Booking Request Flow (Backend)](task-2-booking-request-flow.md)
3. [Booking Accept / Decline / Counter-Propose](task-3-booking-accept-decline-counter.md)
4. [Booking Calendar Views](task-4-booking-calendar-views.md)
5. [Reschedule & Cancellation Rules Engine](task-5-reschedule-cancellation-rules.md)
6. [Notification System Integration for Booking Events](task-6-notification-integration.md)
7. [Booking Flow UI](task-7-booking-flow-ui.md)

## Dependencies

- Sprint 2 complete: students can find and view tutors to book.
- Sprint 0: notification infrastructure accounts (FCM, WhatsApp BSP) provisioned.

## Exit Criteria

- Tutor can define recurring and one-off availability slots.
- Student can submit a booking request against an open slot with duration, subject, mode, and notes.
- Tutor can accept, decline, or counter-propose a different time; student is notified of the outcome via push + email + WhatsApp.
- Both sides see Upcoming / Past / Cancelled booking views.
- Reschedule/cancellation rules (e.g. free cancellation ≥ 12–24h before) are enforced, not just documented.
- This sprint intentionally stops short of payment — a `CONFIRMED` booking exists without money having moved yet; [Sprint 5](../sprint-05-payments/README.md) inserts payment into this flow.
