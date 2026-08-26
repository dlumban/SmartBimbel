# Task 1.4 — Student/Parent Profile Setup

**Sprint:** 1 — Authentication & Onboarding
**Estimate:** 2 days

## Goal

Capture the minimum information needed to power tutor recommendations and filters later (Sprint 2), per PRD §6.1.A.

## Scope

- `POST /students/profile`: grade level, subjects of interest (multi-select from `Subject` master data), preferred location (city/area), preferred teaching mode (online/offline/both).
- Mobile + web onboarding screens for the above, using the `Subject`/`GradeLevel` seed data from [Task 0.4](../sprint-00-foundation/task-4-database-schema.md).
- Basic profile photo upload (optional at this stage — not required to complete onboarding).
- `GET /students/me` / `PATCH /students/me` for viewing and editing after initial setup.

## Acceptance Criteria

- [ ] Student can complete profile setup selecting grade level, ≥1 subject of interest, location, and mode.
- [ ] Profile is editable after initial completion via account settings.
- [ ] Grade level and subject values are constrained to the seeded master data (no free-text subjects at this stage).
- [ ] Completing this profile flips the user's onboarding status to "complete," unlocking the main app.

## Technical Notes

- Keep this form short — PRD's persona (busy parent, Ibu Rina) implies low tolerance for long onboarding forms. Anything not needed for discovery (Sprint 2) can be deferred to profile settings, editable later.

## Dependencies

- [Task 1.3 — Role Selection & Registration Flow](task-3-role-selection-registration.md)
- Sprint 0: [Database Schema](../sprint-00-foundation/task-4-database-schema.md) (Subject/GradeLevel seed data)
