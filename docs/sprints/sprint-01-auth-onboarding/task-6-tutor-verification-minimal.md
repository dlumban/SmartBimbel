# Task 1.6 — Minimal Tutor Verification Workflow

**Sprint:** 1 — Authentication & Onboarding
**Estimate:** 1.5 days

## Goal

PRD §6.1.A requires manual admin review of tutor documents before a profile goes live, but the full [Admin Panel](../sprint-07-admin-panel/README.md) isn't built until Sprint 7. This task provides the minimum needed so tutors aren't blocked for six sprints waiting on a UI that doesn't exist yet.

## Scope

- Backend endpoint (internal-only, e.g. protected by a hardcoded admin-role check, not yet a full RBAC system): `PATCH /internal/tutors/:id/verification` — sets `verificationStatus` to `VERIFIED` or `REJECTED` with an optional reason.
- A bare-bones internal tool to exercise this: either Prisma Studio (acceptable for MVP team size) or a single unstyled internal page listing pending tutors with approve/reject buttons — pick based on team size and comfort with direct DB tooling.
- Tutor-facing status reflection: `PENDING` / `VERIFIED` / `REJECTED` state shown in the tutor's app, with rejection reason if applicable.
- Verified tutors become visible in discovery (this becomes enforceable once [Sprint 2](../sprint-02-discovery/README.md) ships, but the flag must exist and be respected from day one).

## Acceptance Criteria

- [ ] An operator can move a tutor from `PENDING` to `VERIFIED` or `REJECTED` without needing the full Sprint 7 admin panel.
- [ ] Only `VERIFIED` tutors are eligible to appear in search results (enforced at the query level once discovery exists).
- [ ] Tutor sees their current verification status and, if rejected, the reason.
- [ ] The internal verification endpoint is not reachable by non-admin users (even without full RBAC, it must not be a public route).

## Technical Notes

- This is explicitly a stopgap — don't build role-based access control or an admin UI here; that's [Sprint 7](../sprint-07-admin-panel/README.md). A single environment-variable-gated admin user ID or a minimal `role === 'ADMIN'` check is sufficient for MVP internal use.
- Flag this task's endpoint clearly (e.g. `/internal/...` prefix) so it's easy to find and formalize into the real admin panel later rather than accidentally left as permanent tech debt.

## Dependencies

- [Task 1.5 — Tutor Multi-Step Profile Completion](task-5-tutor-profile-completion.md)
