# Task 0.4 — Core Database Schema & Data Models

**Sprint:** 0 — Foundation & Tech Setup
**Estimate:** 3 days

## Goal

Translate PRD §10's high-level data model list into a concrete Prisma schema that every feature sprint extends rather than redesigns.

## Scope

Define Prisma models (fields kept minimal here; sprints add columns as features land):

- `User` — id, role (`STUDENT`, `TUTOR`, `ADMIN`), phone, email, firebaseUid, status, timestamps.
- `TutorProfile` — userId, bio, photoUrl, education, subjects[], gradeLevels[], hourlyRate, teachingModes (online/offline), city, verificationStatus.
- `StudentProfile` — userId, gradeLevel, subjectsOfInterest[], preferredLocation, preferredMode.
- `Subject`, `GradeLevel` — master data tables, seedable.
- `AvailabilitySlot` — tutorId, dayOfWeek/date, startTime, endTime, isRecurring.
- `Booking` — studentId, tutorId, subjectId, slot/time, duration, mode, status (`REQUESTED`, `ACCEPTED`, `DECLINED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`), notes.
- `Conversation`, `Message` — tied to a `Booking`.
- `Transaction` — bookingId, amount, commission, gatewayRef, status.
- `Payout` — tutorId, amount, status, bankAccountRef.
- `Review` — bookingId, rating, text, timestamps.

Also:

- Set up Prisma migrations workflow (`prisma migrate dev` locally, `prisma migrate deploy` in CI/CD).
- Seed script with sample subjects, grade levels, and a handful of test users/tutors for local dev.
- ERD diagram (Mermaid or dbdiagram.io) committed to `docs/data-model.md`.

## Acceptance Criteria

- [ ] `prisma migrate dev` runs cleanly from an empty database.
- [ ] Seed script populates enough data to exercise discovery, booking, and review flows manually.
- [ ] Every entity in PRD §10 has a corresponding model.
- [ ] ERD is committed and matches the actual schema.
- [ ] Foreign keys and indexes exist for all high-traffic lookups (tutor search by subject/city, booking by user, messages by conversation).

## Technical Notes

- Model `Booking` status as an enum, not a free-text field — the state machine in Sprint 3 depends on it.
- Keep `Conversation` scoped to a `Booking` per PRD §6.1.D ("activated after booking request or confirmation") rather than a generic DM system — this simplifies moderation and access control.
- Don't model payout batching or dispute workflow tables yet — add them in Sprint 5/7 when those features are built, to avoid speculative schema.

## Dependencies

- [Task 0.1 — Repository & Monorepo Structure Setup](task-1-repo-monorepo-setup.md)
- [Task 0.3 — Cloud Environments](task-3-cloud-environments.md)
