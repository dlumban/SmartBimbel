# Task 8.2 — Performance Optimization & Load Testing

**Sprint:** 8 — Hardening & Soft Launch
**Estimate:** 3 days

## Goal

Meet PRD §7's performance targets ("Page/app load < 3 seconds on typical 4G networks... smooth on mid-range Android," "designed to support thousands of concurrent users initially").

## Scope

- API load testing (k6 or similar) against key endpoints: tutor search ([Sprint 2](../sprint-02-discovery/task-2-tutor-listing-api.md)), booking creation ([Sprint 3](../sprint-03-booking/task-2-booking-request-flow.md)), payment webhook handling ([Sprint 5](../sprint-05-payments/task-1-payment-gateway-integration.md)) — target a defined concurrent-user number consistent with PRD §3's MVP targets (2,000+ students, 500+ tutors).
- Database query review: confirm indexes from [Task 0.4](../sprint-00-foundation/task-4-database-schema.md) are actually being used (`EXPLAIN ANALYZE` on hot queries), fix any sequential scans on high-traffic tables.
- Frontend performance: bundle size audit (web), image optimization for tutor photos, lazy loading on discovery lists, Flutter app startup time profiling.
- Redis caching review: confirm caching from [Task 2.2](../sprint-02-discovery/task-2-tutor-listing-api.md)/[Task 2.1](../sprint-02-discovery/task-1-subjects-gradelevels-master-data.md) is effective under load.
- 4G network throttling test (Chrome DevTools / real device on throttled connection) against the sub-3s target.

## Acceptance Criteria

- [ ] Load test confirms the API sustains the target concurrent-user load without error-rate spikes or unacceptable latency growth.
- [ ] No unindexed sequential scans remain on high-traffic query paths.
- [ ] Tutor discovery list loads in under 3 seconds on a throttled 4G connection.
- [ ] Mobile app cold-start time is measured and documented as a baseline for future regression tracking.

## Dependencies

- All feature sprints (0–7) functionally complete.
