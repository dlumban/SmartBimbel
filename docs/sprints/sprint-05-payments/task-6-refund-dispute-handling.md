# Task 5.6 — Refund & Dispute Handling

**Sprint:** 5 — Payments & Payouts
**Estimate:** 2.5 days

## Goal

PRD §6.1.E requires "basic refund and dispute handling (admin-mediated)" — build the underlying data model and mechanics here; the review/resolution UI is [Sprint 7](../sprint-07-admin-panel/task-5-dispute-resolution-tools.md).

## Scope

- `Dispute` model: bookingId, raisedBy, reason, status (`OPEN`, `UNDER_REVIEW`, `RESOLVED_REFUND`, `RESOLVED_NO_REFUND`), resolution notes.
- `POST /disputes`: either party can raise a dispute against a booking (e.g. session didn't happen, quality issue, no-show — ties into the no-show flag from [Sprint 3, Task 3.5](../sprint-03-booking/task-5-reschedule-cancellation-rules.md)).
- `POST /internal/disputes/:id/resolve`: admin-only (reuse the minimal admin-gating pattern from [Task 1.6](../sprint-01-auth-onboarding/task-6-tutor-verification-minimal.md) until [Sprint 7](../sprint-07-admin-panel/README.md) formalizes it), triggers a Midtrans refund via API when resolution is `RESOLVED_REFUND`.
- Refund processing: partial or full refund support (Midtrans refund API), updates the `Transaction` status accordingly.
- Notification to both parties on dispute status change.

## Acceptance Criteria

- [ ] Either party can raise a dispute against a booking with a reason.
- [ ] An admin-resolved refund correctly triggers a Midtrans refund and updates transaction/booking status.
- [ ] A resolved-without-refund dispute is recorded and closed without touching the transaction.
- [ ] Both parties are notified when dispute status changes.
- [ ] Non-admin users cannot resolve disputes, verified by a test.

## Technical Notes

- This task builds the mechanics only; the actual admin review queue/UI is explicitly [Sprint 7, Task 7.5](../sprint-07-admin-panel/task-5-dispute-resolution-tools.md) — avoid building admin UI here, use the same internal-endpoint stopgap pattern established in Sprint 1.

## Dependencies

- [Task 5.3 — Platform Commission & Transaction Ledger](task-3-commission-transaction-ledger.md)
- Sprint 3: [Reschedule & Cancellation Rules Engine](../sprint-03-booking/task-5-reschedule-cancellation-rules.md) (no-show flag as dispute context)
