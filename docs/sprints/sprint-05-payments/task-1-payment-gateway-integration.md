# Task 5.1 — Payment Gateway Integration (Midtrans)

**Sprint:** 5 — Payments & Payouts
**Estimate:** 4 days

## Goal

Wire Midtrans (primary gateway per the architectural decision in the [sprints README](../README.md)) into the backend, covering the local payment methods named in PRD §6.1.E.

## Scope

- Midtrans Snap or Core API integration (Snap recommended for MVP — hosted payment page reduces PCI scope and implementation time versus Core API's custom checkout).
- Support QRIS, GoPay, OVO, DANA, ShopeePay, Virtual Account (major banks), and bank transfer per PRD §6.1.E.
- Webhook endpoint (`POST /webhooks/midtrans`) to receive payment status updates — signature verification required (never trust an unverified webhook payload).
- Idempotency handling: webhook may be delivered more than once; processing must be safe to repeat without double-crediting a transaction.
- Sandbox testing across every supported payment method before moving to production credentials.

## Acceptance Criteria

- [ ] A test transaction succeeds end-to-end in Midtrans sandbox for at least QRIS, one e-wallet, and virtual account.
- [ ] Webhook signature verification rejects tampered/unsigned payloads.
- [ ] Replaying the same webhook payload twice does not double-process the transaction (verified by a test).
- [ ] Payment failures (declined, expired, cancelled by user) are handled and reflected in `Transaction` status without leaving bookings in a stuck state.
- [ ] Production credentials are documented as a manual cutover step, gated on Midtrans business verification completing (tracked from [Task 0.6](../sprint-00-foundation/task-6-third-party-accounts.md)).

## Technical Notes

- Snap's hosted checkout page is the faster path to a working, secure integration for MVP — Core API (custom UI) can be revisited later if conversion data suggests the redirect hurts checkout completion.
- Treat the webhook handler as the single source of truth for payment status — never mark a transaction paid based solely on the client-side redirect callback, which can be spoofed or interrupted.

## Dependencies

- Sprint 0: [Third-Party Service Accounts](../sprint-00-foundation/task-6-third-party-accounts.md) (Midtrans)
- Sprint 0: [Database Schema](../sprint-00-foundation/task-4-database-schema.md) (`Transaction` model)
