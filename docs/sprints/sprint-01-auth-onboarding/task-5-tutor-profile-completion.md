# Task 1.5 — Tutor Multi-Step Profile Completion

**Sprint:** 1 — Authentication & Onboarding
**Estimate:** 4 days

## Goal

Capture everything PRD §6.1.A requires for a tutor profile, across a multi-step flow that can be resumed (per [Task 1.3](task-3-role-selection-registration.md)) and that ends in a state ready for verification.

## Scope

- Multi-step form (mobile + web), steps: (1) photo + bio, (2) subjects + grade levels taught, (3) hourly rate(s), (4) teaching mode (online/offline/both) + city/area, (5) education background (institution, degree, graduation year), (6) initial availability (can be a lightweight version — full recurring/one-off slot management is [Sprint 3](../sprint-03-booking/README.md)).
- Document upload for verification: KTP photo and/or diploma, stored securely (private bucket, not publicly accessible URLs) per PRD §6.1.A.
- `POST /tutors/profile` (supports partial saves per step) and `GET /tutors/me`.
- On final step submission, `TutorProfile.verificationStatus` is set to `PENDING`.
- Validation: hourly rate > 0, at least one subject and one grade level selected, at least one teaching mode selected.

## Acceptance Criteria

- [ ] Tutor can complete all profile steps across mobile and web with identical resulting data.
- [ ] Uploaded KTP/diploma documents are stored in a private, access-controlled location — not a public URL guessable by ID.
- [ ] Partial progress is saved between steps (closing mid-flow resumes correctly, per [Task 1.3](task-3-role-selection-registration.md)).
- [ ] Submitting the final step sets `verificationStatus = PENDING` and shows the tutor a "your profile is under review" state.
- [ ] Validation errors are surfaced per-field, not as a generic failure.

## Technical Notes

- Store document uploads in Firebase Storage/Cloudinary with signed URLs or admin-only access rules — these are identity documents and need to be treated accordingly under PRD §7's data protection requirement.
- The "initial availability" captured here is intentionally lightweight (e.g. a few default weekly slots); the full availability management UI is built in [Sprint 3, Task 3.1](../sprint-03-booking/task-1-tutor-availability-management.md) — don't over-build scheduling logic here.

## Dependencies

- [Task 1.3 — Role Selection & Registration Flow](task-3-role-selection-registration.md)
- Sprint 0: [Database Schema](../sprint-00-foundation/task-4-database-schema.md), [Third-Party Accounts](../sprint-00-foundation/task-6-third-party-accounts.md) (storage)
