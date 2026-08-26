# Sprint 5 — Payments & Payouts

**Duration:** 2.5 weeks
**PRD reference:** §6.1.E

## Goal

Complete the "Pay" step of the PRD §8 happy path: student pays after tutor acceptance, platform takes commission, tutor can withdraw earnings, and disputes have an admin-mediated path.

## Scope

1. [Payment Gateway Integration (Midtrans)](task-1-payment-gateway-integration.md)
2. [Booking Payment Flow](task-2-booking-payment-flow.md)
3. [Platform Commission & Transaction Ledger](task-3-commission-transaction-ledger.md)
4. [Tutor Earnings Dashboard](task-4-tutor-earnings-dashboard.md)
5. [Payout Request & Processing](task-5-payout-request-processing.md)
6. [Refund & Dispute Handling](task-6-refund-dispute-handling.md)

## Dependencies

- Sprint 3 complete: an `ACCEPTED` booking must exist for payment to attach to.
- Sprint 0: Midtrans production business verification should be far enough along to have real (or near-real) credentials by the end of this sprint — flagged as a lead-time risk in [Task 0.6](../sprint-00-foundation/task-6-third-party-accounts.md).

## Exit Criteria

- Student can pay for an accepted booking via QRIS, e-wallets (GoPay/OVO/DANA/ShopeePay), virtual account, or bank transfer.
- Successful payment moves the booking from `ACCEPTED` to `CONFIRMED` and triggers confirmation notifications ([Sprint 3, Task 3.6](../sprint-03-booking/task-6-notification-integration.md)).
- Platform commission (default 15%, configurable per PRD §6.1.E) is correctly calculated and recorded on every transaction.
- Tutor can view earnings and request a payout to their bank account.
- Basic refund/dispute flow exists for admin-mediated resolution (full admin UI in [Sprint 7](../sprint-07-admin-panel/README.md); this sprint provides the underlying mechanics and data model).
- This is the highest-risk sprint in the roadmap — real money movement. Budget extra time for webhook reliability, idempotency, and reconciliation testing.
