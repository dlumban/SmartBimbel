# Task 7.1 — Admin Panel Foundation & RBAC

**Sprint:** 7 — Admin Panel
**Estimate:** 3 days

## Goal

Stand up `apps/admin` as a real application with proper role-based access control, replacing the ad hoc env-var/hardcoded-role checks used as stopgaps in [Task 1.6](../sprint-01-auth-onboarding/task-6-tutor-verification-minimal.md) and [Task 5.6](../sprint-05-payments/task-6-refund-dispute-handling.md).

## Scope

- `apps/admin` Next.js app: login (reuses [Sprint 1](../sprint-01-auth-onboarding/README.md)'s auth, restricted to `ADMIN` role), shell layout (nav, top bar), design system applied per [Task 0.5](../sprint-00-foundation/task-5-design-system.md).
- Two admin sub-roles per PRD §5: **Super Admin** (full access, including payout approval and role management) and **Support** (user/booking/dispute handling, no financial approval rights).
- Backend: formal `AdminRole` distinction (extend the `User.role` enum or add a sub-role field) and update `RolesGuard` from [Task 1.7](../sprint-01-auth-onboarding/task-7-session-auth-guards.md) to support sub-role checks.
- Audit log: every admin action (approve tutor, resolve dispute, approve payout) is logged with admin ID, action, target, timestamp.
- Retire the Sprint 1/Sprint 5 stopgap endpoints' informal access checks in favor of this formal RBAC.

## Acceptance Criteria

- [ ] Only users with an `ADMIN` role (and appropriate sub-role) can log into `apps/admin`.
- [ ] Support-role admins cannot access Super-Admin-only actions (e.g. payout approval), verified by a test.
- [ ] Every admin action taken through the panel is recorded in the audit log with enough detail to answer "who did what, when" during a later dispute review.
- [ ] The informal admin-gating pattern from Sprint 1/5 is removed and replaced by this formal system.

## Technical Notes

- This task is explicitly about formalizing access control infrastructure — the feature screens themselves (tutor approval, dispute resolution, etc.) are the following tasks in this sprint.

## Dependencies

- Sprint 1: [Session Management & Auth Guards](../sprint-01-auth-onboarding/task-7-session-auth-guards.md)
- Sprint 0: [Repository & Monorepo Structure](../sprint-00-foundation/task-1-repo-monorepo-setup.md) (`apps/admin` scaffold)
