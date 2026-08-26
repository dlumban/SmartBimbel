# Task 8.1 — End-to-End Testing & QA Pass

**Sprint:** 8 — Hardening & Soft Launch
**Estimate:** 4 days

## Goal

Verify the full PRD §8 happy path and its edge cases actually work end-to-end across both platforms before real users touch the product.

## Scope

- Playwright E2E suite (web): registration → tutor discovery → booking → payment (Midtrans sandbox) → chat → session completion → review, covering both student and tutor perspectives.
- Flutter integration test suite (mobile): same critical path.
- Edge case matrix: booking expiry, payment failure/retry, tutor decline/counter-propose, cancellation inside/outside free window, dispute + refund, unverified tutor invisibility, concurrent booking race condition (from [Sprint 3, Task 3.2](../sprint-03-booking/task-2-booking-request-flow.md)).
- Manual QA pass on real mid-range Android devices (not just emulators), covering PRD §7's device target.
- Bug triage and fix pass on everything found, prioritized by severity.

## Acceptance Criteria

- [ ] Automated E2E suite passes for the full happy path on both web and mobile.
- [ ] Every edge case in the matrix above has a passing automated or documented manual test.
- [ ] No critical or high-severity bugs remain open at sprint end.
- [ ] Manual QA sign-off recorded for at least 2 real mid-range Android devices.

## Dependencies

- All feature sprints (0–7) functionally complete.
