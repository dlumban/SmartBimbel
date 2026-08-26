# Task 6.4 — Ratings & Reviews System

**Sprint:** 6 — Session Management & Reviews
**Estimate:** 2 days

## Goal

PRD §6.1.G: after session completion, star rating + optional text review.

## Scope

- `POST /bookings/:id/review`: student rates (1–5 stars) and optionally writes a text review after a booking reaches `COMPLETED`. One review per completed booking, editable within a short window (e.g. 24–48h) then locked.
- Review moderation flag: basic profanity/abuse filter or admin-flaggable (full moderation UI is [Sprint 7](../sprint-07-admin-panel/README.md); this task just needs a `flagged` field and a simple keyword filter as a first pass).
- Review prompt UX: triggered after session completion (push notification + in-app prompt), skippable but re-surfaced once.
- Tutors cannot review students for MVP (one-directional review, per PRD §6.1.G's phrasing — confirm this reading with stakeholder if two-directional review is actually wanted).

## Acceptance Criteria

- [ ] A student can submit exactly one rating (+ optional text) per completed booking.
- [ ] Attempting a second review for the same booking is rejected.
- [ ] Reviews containing flagged keywords are marked `flagged` for later admin review, not blocked outright (avoid false-positive censorship without human review).
- [ ] Review submission is prompted after session completion via notification.

## Technical Notes

- Confirm review directionality (student → tutor only, vs. mutual) as a product decision before building — the PRD's phrasing implies one-directional but doesn't explicitly rule out mutual reviews building trust both ways.

## Dependencies

- [Task 6.1 — Session Lifecycle](task-1-session-lifecycle.md)
