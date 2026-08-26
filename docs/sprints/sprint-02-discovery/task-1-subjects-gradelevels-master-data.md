# Task 2.1 — Subjects & Grade Levels Master Data Management

**Sprint:** 2 — Tutor Discovery & Search
**Estimate:** 1 day

## Goal

The `Subject` and `GradeLevel` tables were seeded minimally in Sprint 0; this task makes them complete and manageable enough to support real filtering.

## Scope

- Finalize the full `Subject` list (Matematika, Fisika, Kimia, Biologi, Bahasa Inggris, Bahasa Indonesia, UTBK/SNBT prep tracks, etc.) and `GradeLevel` list (SD 1–6, SMP 7–9, SMA 10–12, UTBK) per PRD §1/§6.1.B.
- `GET /subjects`, `GET /grade-levels` public read endpoints (cached — this data changes rarely).
- Seed script updated with the finalized lists, re-run against dev/staging.
- Simple internal update path (direct DB/Prisma Studio is acceptable for MVP — no admin UI needed for master data at this stage).

## Acceptance Criteria

- [ ] `GET /subjects` and `GET /grade-levels` return the complete, finalized lists.
- [ ] Responses are cached (Redis or HTTP cache headers) since this data is near-static.
- [ ] Tutor profile subject/grade-level selection ([Task 1.5](../sprint-01-auth-onboarding/task-5-tutor-profile-completion.md)) and student subject-of-interest selection ([Task 1.4](../sprint-01-auth-onboarding/task-4-student-profile-setup.md)) both draw from this same finalized list.

## Technical Notes

- Keep this list-driven, not free text — filtering and matching in later tasks depend on a closed vocabulary.

## Dependencies

- Sprint 0: [Database Schema](../sprint-00-foundation/task-4-database-schema.md)
