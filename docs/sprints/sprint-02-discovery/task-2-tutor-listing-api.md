# Task 2.2 — Tutor Listing API

**Sprint:** 2 — Tutor Discovery & Search
**Estimate:** 3 days

## Goal

Backend endpoint that powers the browse list/grid view described in PRD §6.1.B, performant enough to support filtering and pagination from day one.

## Scope

- `GET /tutors`: paginated (cursor or offset — choose one and document it), returns photo, name, subjects, hourly rate, rating (avg + count), city, online/offline mode badge, verification badge.
- Only `verificationStatus = VERIFIED` tutors are returned.
- Pagination performance: appropriate indexes on `TutorProfile` (city, subjects, rate, rating) — coordinate with [Task 0.4](../sprint-00-foundation/task-4-database-schema.md)'s index plan.
- Response shape defined in `packages/shared` so mobile/web/admin all consume the same contract.
- Basic caching for the default (unfiltered, first-page) query, since it's the most repeated request.

## Acceptance Criteria

- [ ] `GET /tutors` returns correctly paginated results with all fields the discovery UI ([Task 2.6](task-6-discovery-ui.md)) needs.
- [ ] Unverified tutors never appear in results, verified by a test with a mixed-status seed set.
- [ ] Response time stays under 300ms at seeded dev data volume (PRD §7 targets sub-3s page loads overall — the API should be a small fraction of that budget).
- [ ] Pagination is stable (no duplicate/skipped results) when new tutors are added between page fetches.

## Technical Notes

- This endpoint is the foundation [Task 2.3 (Filters)](task-3-search-filters.md) extends — design its query parameters with filters in mind from the start rather than bolting them on after.

## Dependencies

- Sprint 1: verified tutor data must exist to list.
- [Task 2.1 — Subjects & Grade Levels Master Data](task-1-subjects-gradelevels-master-data.md)
