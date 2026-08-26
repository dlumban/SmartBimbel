# Task 3.6 — Notification System Integration for Booking Events

**Sprint:** 3 — Booking & Scheduling
**Estimate:** 3 days

## Goal

Build the shared `notifications` module (per the Sprint plan's architecture note) and wire it to every booking state change, satisfying PRD §6.1.C's "Push + Email + WhatsApp" requirement.

## Scope

- `notifications` NestJS module: a single `NotificationService.send(userId, template, data, channels[])` interface used by feature modules — booking code calls this, not FCM/WhatsApp/email SDKs directly.
- Channel adapters: FCM push, WhatsApp Business API (via the BSP selected in [Task 0.6](../sprint-00-foundation/task-6-third-party-accounts.md)), email (SES/SendGrid) as fallback.
- BullMQ queue for notification sending (async, retryable — don't block booking API responses on third-party notification delivery).
- Templates for: booking requested (to tutor), booking accepted/declined/countered (to student), booking cancelled (to both), reminder (e.g. 24h and 1h before session — scheduled job).
- User notification preferences (minimal for MVP: at least allow opting out of WhatsApp if it proves too aggressive — full preference center is post-MVP).

## Acceptance Criteria

- [ ] Every booking state change from [Task 3.3](task-3-booking-accept-decline-counter.md) triggers the correct notification(s) across push, email, and WhatsApp.
- [ ] Notification sending failures (e.g. WhatsApp API down) don't fail the underlying booking API call — they retry via the queue.
- [ ] Session reminders fire at the correct times relative to the booked session (verified with a test using a mocked clock or short-interval test data).
- [ ] A user who disables WhatsApp notifications stops receiving them but still receives push/email.

## Technical Notes

- This module becomes the single integration point for all future notification needs (payments in [Sprint 5](../sprint-05-payments/README.md), reviews in [Sprint 6](../sprint-06-sessions-reviews/README.md)) — invest in getting the interface right now rather than each sprint adding its own ad hoc notification code.
- WhatsApp Business API production access (submitted in [Task 0.6](../sprint-00-foundation/task-6-third-party-accounts.md)) may still be pending approval when this task starts — build against the BSP's sandbox/test mode and confirm production credentials are swapped in before [Sprint 8](../sprint-08-hardening-launch/README.md).

## Dependencies

- [Task 3.3 — Booking Accept / Decline / Counter-Propose](task-3-booking-accept-decline-counter.md)
- Sprint 0: [Third-Party Service Accounts](../sprint-00-foundation/task-6-third-party-accounts.md) (FCM, WhatsApp BSP, email)
