# Task 7.2 — Tutor Approval Workflow UI

**Sprint:** 7 — Admin Panel
**Estimate:** 2 days

## Goal

Replace the Prisma-Studio-or-bare-page stopgap from [Task 1.6](../sprint-01-auth-onboarding/task-6-tutor-verification-minimal.md) with a real review UI, per PRD §6.1.H ("Approve / reject tutor profiles").

## Scope

- Pending tutor queue: list of `PENDING` tutors with profile summary, uploaded KTP/diploma documents (rendered securely — signed URLs, not public links), education background.
- Approve/reject actions with required rejection reason (shown to the tutor per [Task 1.6](../sprint-01-auth-onboarding/task-6-tutor-verification-minimal.md)'s existing tutor-facing status display).
- Re-review flow: a rejected tutor who resubmits a corrected profile reappears in the queue.
- Filters/search on the queue (by submission date, city, subject) for when volume grows.

## Acceptance Criteria

- [ ] Admin can review a pending tutor's full profile and documents without leaving the panel.
- [ ] Approving/rejecting updates `verificationStatus` and is reflected immediately in the tutor-facing app and in [Sprint 2](../sprint-02-discovery/README.md) search visibility.
- [ ] Rejection requires a reason, which the tutor can see.
- [ ] A resubmitted, corrected profile re-enters the pending queue correctly.

## Dependencies

- [Task 7.1 — Admin Panel Foundation & RBAC](task-1-admin-panel-foundation-rbac.md)
- Sprint 1: [Minimal Tutor Verification Workflow](../sprint-01-auth-onboarding/task-6-tutor-verification-minimal.md) (data model and tutor-facing status this replaces the internal tooling for)
