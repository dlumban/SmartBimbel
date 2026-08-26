# Task 7.6 — Analytics Dashboard

**Sprint:** 7 — Admin Panel
**Estimate:** 2.5 days

## Goal

PRD §6.1.H: "Basic analytics (users, GMV, bookings, conversion)" — give the team direct visibility into the success metrics defined in PRD §3, rather than requiring manual DB queries.

## Scope

- Dashboard widgets: registered tutors count, registered students count, completed bookings count, booking conversion rate (requested → confirmed), GMV (gross transaction value) and platform take (commission revenue), average session rating, tutor activation rate (tutors with ≥1 completed booking / total verified tutors), student second-booking rate.
- Date-range filtering (last 7/30/90 days, custom range) and basic trend charts.
- City-level breakdown, since PRD §1/§3 frames success partly in terms of multi-city traction (Jabodetabek, Bandung, Surabaya, Medan, Yogyakarta).
- This is intentionally a lightweight, purpose-built dashboard for the metrics PRD §3 already defines — not a general BI tool.

## Acceptance Criteria

- [ ] Every metric named in PRD §3's success metrics table is visible on this dashboard.
- [ ] Numbers match manual verification against the underlying database for a seeded test dataset.
- [ ] Date-range filtering correctly recomputes all widgets.
- [ ] City breakdown correctly attributes bookings/GMV to the tutor's registered city.

## Technical Notes

- Firebase Analytics + Mixpanel/Amplitude (from [Task 0.6](../sprint-00-foundation/task-6-third-party-accounts.md)) cover product usage analytics separately — this dashboard is specifically the business/operational metrics from PRD §3, computed from the platform's own database, not from the event-analytics tools.

## Dependencies

- [Task 7.1 — Admin Panel Foundation & RBAC](task-1-admin-panel-foundation-rbac.md)
- All prior sprints (this aggregates data created throughout the roadmap).
