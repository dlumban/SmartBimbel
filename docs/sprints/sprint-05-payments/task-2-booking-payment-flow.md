# Task 5.2 — Booking Payment Flow

**Sprint:** 5 — Payments & Payouts
**Estimate:** 3 days

## Goal

Connect Midtrans (from [Task 5.1](task-1-payment-gateway-integration.md)) to the booking state machine (from [Sprint 3](../sprint-03-booking/task-3-booking-accept-decline-counter.md)) so payment is what actually confirms a booking, per PRD §6.1.E and the §8 happy path.

## Scope

- `POST /bookings/:id/pay`: creates a Midtrans Snap transaction for an `ACCEPTED` booking's amount, returns the payment URL/token to the client.
- On confirmed webhook payment success: booking moves `ACCEPTED` → `CONFIRMED`; on failure/expiry: booking stays `ACCEPTED` (student can retry) or reverts per a defined timeout policy.
- Payment amount calculation: tutor's rate × duration, using the values locked in at booking-request time (not the tutor's current rate, in case it changed since the request was made).
- Payment UI: mobile/web checkout screen launching Midtrans Snap, handling success/pending/failure redirect states.
- Payment timeout: if a student doesn't complete payment within a defined window after acceptance, the booking is released (mirrors the request-expiry pattern from [Task 3.2](../sprint-03-booking/task-2-booking-request-flow.md)).

## Acceptance Criteria

- [ ] Paying for an `ACCEPTED` booking successfully moves it to `CONFIRMED` and triggers confirmation notifications.
- [ ] Payment amount is locked to the rate at booking-request time, verified by a test where the tutor's rate changes between request and payment.
- [ ] Failed or abandoned payments leave the booking in a recoverable state (retryable), not stuck or silently confirmed.
- [ ] Unpaid `ACCEPTED` bookings expire after the defined timeout, releasing the slot.

## Technical Notes

- This is the point where PRD §8's "Student completes payment" step and PRD §6.1.C's booking flow actually meet — keep the two modules' interaction narrow (this task's endpoint is the only place booking status is mutated based on payment events).

## Dependencies

- [Task 5.1 — Payment Gateway Integration](task-1-payment-gateway-integration.md)
- Sprint 3: [Booking Accept / Decline / Counter-Propose](../sprint-03-booking/task-3-booking-accept-decline-counter.md)
