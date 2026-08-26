# Task 7.4 — Transaction & Payout Management

**Sprint:** 7 — Admin Panel
**Estimate:** 2.5 days

## Goal

PRD §6.1.H: "payout approval" — give Super Admins the interface to process the payout requests created in [Sprint 5, Task 5.5](../sprint-05-payments/task-5-payout-request-processing.md).

## Scope

- Transaction list/search: all platform transactions with gross/commission/net breakdown, gateway status, linked booking.
- Payout queue: `PENDING` payout requests, tutor details, bank account info, amount.
- Approve action: triggers the Midtrans Disbursement API call (or marks for manual bank transfer, per the approach chosen in [Task 5.5](../sprint-05-payments/task-5-payout-request-processing.md)), updates status to `PROCESSING`/`COMPLETED`.
- Reject action: with required reason, notifies the tutor.
- Reconciliation view: flags any transaction whose Midtrans status disagrees with the platform's recorded status (safety net for webhook delivery gaps).

## Acceptance Criteria

- [ ] Super Admin can review and approve/reject pending payout requests, with the disbursement actually executing on approval.
- [ ] Payout approval is restricted to Super Admin (not Support), per [Task 7.1](task-1-admin-panel-foundation-rbac.md)'s RBAC split.
- [ ] Reconciliation view correctly surfaces at least one seeded mismatched-status test case.
- [ ] Every approval/rejection is audit-logged with admin identity.

## Dependencies

- [Task 7.1 — Admin Panel Foundation & RBAC](task-1-admin-panel-foundation-rbac.md)
- Sprint 5: [Payout Request & Processing](../sprint-05-payments/task-5-payout-request-processing.md)
