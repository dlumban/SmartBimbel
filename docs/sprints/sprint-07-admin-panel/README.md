# Sprint 7 — Admin Panel

**Duration:** 2 weeks
**PRD reference:** §6.1.H

## Goal

Formalize the admin capabilities that were stubbed as internal-only endpoints in earlier sprints ([Task 1.6](../sprint-01-auth-onboarding/task-6-tutor-verification-minimal.md), [Task 5.6](../sprint-05-payments/task-6-refund-dispute-handling.md)) into a real, role-based admin web panel per PRD §6.1.H, plus the analytics view needed to track PRD §3's success metrics.

## Scope

1. [Admin Panel Foundation & RBAC](task-1-admin-panel-foundation-rbac.md)
2. [Tutor Approval Workflow UI](task-2-tutor-approval-workflow-ui.md)
3. [User & Booking Management](task-3-user-booking-management.md)
4. [Transaction & Payout Management](task-4-transaction-payout-management.md)
5. [Dispute Resolution Tools](task-5-dispute-resolution-tools.md)
6. [Analytics Dashboard](task-6-analytics-dashboard.md)

## Dependencies

- All prior sprints: this sprint is largely a UI/RBAC formalization layer over data and endpoints that already exist (tutor verification from Sprint 1, bookings from Sprint 3, transactions/disputes from Sprint 5, reviews from Sprint 6).

## Exit Criteria

- `apps/admin` has real authentication and role-based access (Super Admin vs Support staff, per PRD §5).
- Every internal-only stopgap endpoint built in earlier sprints (tutor verification, dispute resolution) is replaced by a proper admin-panel screen with the same or better functionality, and the old ad hoc access pattern (env-var-gated checks) is retired.
- Admin can manage users, bookings, transactions, payouts, and disputes from one place.
- Basic analytics dashboard tracks the metrics named in PRD §3 (registered tutors/students, completed bookings, GMV, take rate, ratings).
