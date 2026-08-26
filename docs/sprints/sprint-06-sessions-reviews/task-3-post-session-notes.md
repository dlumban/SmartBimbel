# Task 6.3 — Post-Session Notes

**Sprint:** 6 — Session Management & Reviews
**Estimate:** 1 day

## Goal

PRD §6.1.F: "Basic post-session notes" — lightweight enough for MVP, not a full progress-tracking system (that's Phase 2 per PRD §6.2).

## Scope

- `PATCH /bookings/:id/notes`: tutor adds free-text notes after a session (topics covered, homework/next steps) — visible to the student/parent.
- Notes UI on the booking detail screen, editable by the tutor, read-only for the student.
- Notes are optional — don't block session completion or payout eligibility on notes being filled in.

## Acceptance Criteria

- [ ] Tutor can add/edit post-session notes on a completed booking.
- [ ] Student/parent can view notes but not edit them.
- [ ] Leaving notes blank doesn't block any other flow (completion, payout, review).

## Technical Notes

- Keep this to a single free-text field for MVP — structured progress reports are explicitly PRD §6.2 (Phase 2) scope.

## Dependencies

- [Task 6.1 — Session Lifecycle](task-1-session-lifecycle.md)
