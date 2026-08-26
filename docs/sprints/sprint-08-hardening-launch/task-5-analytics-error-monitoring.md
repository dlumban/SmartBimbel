# Task 8.5 — Analytics & Error Monitoring Finalization

**Sprint:** 8 — Hardening & Soft Launch
**Estimate:** 2 days

## Goal

PRD §7: Firebase Analytics + Mixpanel/Amplitude, Sentry error tracking — confirm these (provisioned as accounts back in [Task 0.6](../sprint-00-foundation/task-6-third-party-accounts.md)) are fully wired to production and actually capturing the events the business needs to track PRD §3's metrics.

## Scope

- Event tracking plan: define and implement the key funnel events (registration, role selection, profile completion, tutor search, booking request/accept/pay/complete, review submitted) across Firebase Analytics and Mixpanel/Amplitude.
- Sentry: confirm production error tracking is live for all four apps (`api`, `web`, `admin`, `mobile`) with proper environment tagging (don't mix staging/production errors in one view) and source maps/symbolication working so stack traces are readable.
- Alerting: Sentry alerts routed to the team (Slack/email) for new error types or spike in error rate; basic uptime alerting from [Task 0.3](../sprint-00-foundation/task-3-cloud-environments.md) confirmed live in production.
- Privacy check: confirm analytics events don't leak PII (e.g. full phone numbers, KTP data) into third-party analytics tools, consistent with [Task 8.3](task-3-security-review-hardening.md)'s data protection review.

## Acceptance Criteria

- [ ] Every funnel event in the tracking plan fires correctly and is visible in Mixpanel/Amplitude within a test run.
- [ ] A deliberately triggered test error in production Sentry is captured with a readable, symbolicated stack trace.
- [ ] Sentry alerts reach the team within a defined SLA (e.g. under 5 minutes) for a test error.
- [ ] No PII is found in a sampled audit of analytics event payloads.

## Dependencies

- Sprint 0: [Third-Party Service Accounts](../sprint-00-foundation/task-6-third-party-accounts.md)
- [Task 8.3 — Security Review & Hardening](task-3-security-review-hardening.md) (PII check coordination)
