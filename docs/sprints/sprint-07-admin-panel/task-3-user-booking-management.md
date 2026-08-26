# Task 7.3 — User & Booking Management

**Sprint:** 7 — Admin Panel
**Estimate:** 3 days

## Goal

PRD §6.1.H: "Manage users, bookings... and disputes" (disputes handled separately in [Task 7.5](task-5-dispute-resolution-tools.md)) — give support staff the tools to handle day-to-day operational issues without engineering intervention.

## Scope

- User list/search/detail (students and tutors): profile view, status (active/suspended), booking/transaction history summary.
- Suspend/reinstate user action (blocks login or platform participation — define exact effect and log via the audit trail from [Task 7.1](task-1-admin-panel-foundation-rbac.md)).
- Booking list/search/detail across the whole platform: filter by status, date range, city, subject; ability to view full booking history including chat reference (link into Stream's dashboard or a read-only in-panel view) for context during support cases.
- Manual booking status override (e.g. force-cancel in an edge case) — Super-Admin-only given its potential to affect payments.

## Acceptance Criteria

- [ ] Admin can find any user or booking via search/filter within a few seconds at expected MVP data volume.
- [ ] Suspending a user actually prevents them from logging in/transacting, verified by a test.
- [ ] Manual booking overrides are restricted to Super Admin and fully audit-logged.
- [ ] Support-role admins can view but not override booking state (per the RBAC split in [Task 7.1](task-1-admin-panel-foundation-rbac.md)).

## Dependencies

- [Task 7.1 — Admin Panel Foundation & RBAC](task-1-admin-panel-foundation-rbac.md)
- Sprint 3: booking data; Sprint 1: user data.
