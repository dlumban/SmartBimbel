# Task 5.5 — Payout Request & Processing

**Sprint:** 5 — Payments & Payouts
**Estimate:** 3 days

## Goal

Let tutors withdraw their available balance to a bank account, per PRD §6.1.E ("Tutor earnings dashboard and payout request (to bank account)").

## Scope

- Tutor bank account details capture (bank name, account number, account holder name) with basic validation; stored securely.
- `POST /payouts/request`: tutor requests a payout up to their available balance; creates a `Payout` record in `PENDING` state.
- Payout processing: for MVP, this can be admin-approved and manually executed via Midtrans Disbursement API or a manual bank transfer workflow — full automation is not required if operational volume is low at launch (document the chosen approach explicitly, since PRD doesn't mandate automatic disbursement).
- Payout status tracking: `PENDING` → `PROCESSING` → `COMPLETED` / `FAILED`, visible to the tutor.
- Minimum payout threshold (product decision, document the chosen value) to avoid excessive small transfers.

## Acceptance Criteria

- [ ] Tutor can request a payout only up to their actual available balance (verified against [Task 5.4](task-4-tutor-earnings-dashboard.md)'s calculation).
- [ ] A payout request is visible to admin (via [Sprint 7](../sprint-07-admin-panel/task-4-transaction-payout-management.md)'s tooling, or a minimal internal view if built before then) for approval/processing.
- [ ] Payout status changes are reflected to the tutor in real time (or on next refresh) with clear state labels.
- [ ] Requesting more than the available balance is rejected with a clear error.

## Technical Notes

- Given operational maturity at MVP stage, a semi-manual (admin-approved, Midtrans Disbursement API-executed) payout flow is reasonable — full automatic same-day payout is a Phase 2 optimization, not an MVP requirement per PRD §6.1.E's phrasing ("payout request," not "instant payout").

## Dependencies

- [Task 5.4 — Tutor Earnings Dashboard](task-4-tutor-earnings-dashboard.md)
