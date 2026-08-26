# Task 8.6 — Soft Launch Readiness

**Sprint:** 8 — Hardening & Soft Launch
**Estimate:** 3 days

## Goal

Convert a feature-complete, hardened MVP into an actually-launched product in 1–2 cities, per PRD §13's Phase 1 exit and the assumptions/risks in PRD §12.

## Scope

- Google Play Store submission: store listing (Bahasa Indonesia primary), screenshots, privacy policy, content rating, production build signed and uploaded. (iOS/App Store submission can follow shortly after, per PRD §1's "Android priority" framing — confirm timeline with stakeholder.)
- Legal/operational readiness: Terms of Service, Privacy Policy, and a defined legal entity/business registration status finalized enough to operate — this closes PRD §14's open question on legal entity and ToS.
- Final commission rate and cancellation policy locked (closes PRD §14's other open questions) and reflected in [Sprint 5, Task 5.3](../sprint-05-payments/task-3-commission-transaction-ledger.md)'s configuration and [Sprint 3, Task 3.5](../sprint-03-booking/task-5-reschedule-cancellation-rules.md)'s policy thresholds.
- Cold-start supply seeding per PRD §12's mitigation: onboard an initial batch of real tutors (from existing networks) in the chosen soft-launch cities before opening to students, so early student demand isn't met with an empty marketplace.
- Rollback plan: documented steps to revert a bad production deploy, including database migration rollback strategy.
- Launch runbook: on-call rotation for the launch window, escalation path for payment/booking incidents, monitoring dashboard links ([Task 8.5](task-5-analytics-error-monitoring.md)).

## Acceptance Criteria

- [ ] App is live on Google Play (or in final review) in the chosen soft-launch cities.
- [ ] ToS and Privacy Policy are published and linked from both the app and website.
- [ ] Commission rate and cancellation policy are finalized, configured, and consistent across payments and booking modules.
- [ ] At least a minimum viable count of verified tutors (product-defined target) exist in each soft-launch city before public student-facing launch.
- [ ] Rollback plan and launch runbook are documented and reviewed by the team.

## Technical Notes

- This task depends on several product/business decisions (commission rate, cancellation policy, legal entity, priority cities) that PRD §14 explicitly leaves open — these need stakeholder sign-off before this task can be considered complete, not just engineering work.

## Dependencies

- [Task 8.1](task-1-e2e-testing-qa.md), [Task 8.2](task-2-performance-load-testing.md), [Task 8.3](task-3-security-review-hardening.md), [Task 8.4](task-4-localization.md), [Task 8.5](task-5-analytics-error-monitoring.md) — this is the final task in the roadmap.
