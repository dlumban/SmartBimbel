# Sprint 8 — Hardening & Soft Launch

**Duration:** 2 weeks
**PRD reference:** §7 (Non-Functional Requirements), §13 (Roadmap)

## Goal

Take the feature-complete MVP from Sprints 0–7 and make it safe, fast, monitored, and legally/operationally ready for a real soft launch in 1–2 cities, per PRD §13's Phase 1 exit.

## Scope

1. [End-to-End Testing & QA Pass](task-1-e2e-testing-qa.md)
2. [Performance Optimization & Load Testing](task-2-performance-load-testing.md)
3. [Security Review & Hardening](task-3-security-review-hardening.md)
4. [Localization (Bahasa Indonesia + English)](task-4-localization.md)
5. [Analytics & Error Monitoring Finalization](task-5-analytics-error-monitoring.md)
6. [Soft Launch Readiness](task-6-soft-launch-readiness.md)

## Dependencies

- Sprints 0–7 functionally complete.

## Exit Criteria

- Full happy-path (PRD §8) and key edge cases are covered by automated and manual QA across mobile and web.
- App load times meet PRD §7's sub-3-second target on typical 4G / mid-range Android.
- Security review completed with no unresolved critical/high findings.
- Full Bahasa Indonesia localization shipped, English as a secondary option.
- Sentry, Firebase Analytics, and Mixpanel/Amplitude are live in production and verified to be capturing real events.
- Android app is submitted to Google Play; production payment and WhatsApp credentials are live (contingent on the approvals kicked off in [Task 0.6](../sprint-00-foundation/task-6-third-party-accounts.md)); rollback plan documented.
