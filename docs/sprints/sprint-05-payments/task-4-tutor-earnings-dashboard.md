# Task 5.4 — Tutor Earnings Dashboard

**Sprint:** 5 — Payments & Payouts
**Estimate:** 2 days

## Goal

Give tutors visibility into what they've earned and what's available to withdraw, per PRD §6.1.E.

## Scope

- `GET /tutors/me/earnings`: total earned (all-time), available balance (completed sessions, commission deducted, not yet paid out), pending balance (payment received but session not yet completed — see [Sprint 6](../sprint-06-sessions-reviews/task-1-session-lifecycle.md) for when a session is considered complete), payout history.
- Earnings dashboard UI (mobile + web): summary cards (available / pending / lifetime), transaction list, link to payout request ([Task 5.5](task-5-payout-request-processing.md)).
- Date-range filtering and simple export (CSV) for tutors who want records for their own accounting.

## Acceptance Criteria

- [ ] Available balance only includes transactions tied to `COMPLETED` sessions, not merely `CONFIRMED`/paid-but-not-yet-taught bookings.
- [ ] Dashboard numbers reconcile exactly with the underlying `Transaction` records (no drift between summary and detail view).
- [ ] CSV export produces a correct, readable transaction history for a selected date range.

## Technical Notes

- The available-vs-pending distinction depends on session completion state from [Sprint 6](../sprint-06-sessions-reviews/task-1-session-lifecycle.md) — if that sprint hasn't landed yet in a parallel-track team, this task can initially treat "paid" as "available" and tighten the rule once session completion exists.

## Dependencies

- [Task 5.3 — Platform Commission & Transaction Ledger](task-3-commission-transaction-ledger.md)
