# Sprint 6 — Session Management & Reviews

**Duration:** 1.5 weeks
**PRD reference:** §6.1.F, §6.1.G

## Goal

Close the loop from a `CONFIRMED` booking to a `COMPLETED` session with a review, finishing the PRD §8 happy path ("Session Occurs → Mark Complete → Rate & Review → Tutor Payout").

## Scope

1. [Session Lifecycle & "Mark Complete" Flow](task-1-session-lifecycle.md)
2. [Join Meeting Button & External Link Handling](task-2-join-meeting-button.md)
3. [Post-Session Notes](task-3-post-session-notes.md)
4. [Ratings & Reviews System](task-4-ratings-reviews-system.md)
5. [Tutor Profile Rating Aggregation Display](task-5-rating-aggregation-display.md)

## Dependencies

- Sprint 3 complete: `CONFIRMED` bookings exist.
- Sprint 4 complete: meeting link/address data captured in chat ([Task 4.3](../sprint-04-messaging/task-3-meeting-link-location-sharing.md)).
- Sprint 5 complete: session completion gates the "available balance" calculation in [Task 5.4](../sprint-05-payments/task-4-tutor-earnings-dashboard.md).

## Exit Criteria

- A `CONFIRMED` booking's session can be marked complete by the tutor (or automatically after the scheduled end time, per the chosen policy).
- Online sessions show a working "Join Meeting" button using the link captured in Sprint 4.
- Tutors can add basic post-session notes.
- Completing a session unlocks rating/review prompts for the student; ratings/reviews display on tutor profiles (closing the loop back to [Sprint 2](../sprint-02-discovery/task-4-tutor-detail-page.md)'s previously-empty reviews section).
- Marking a session complete makes its associated transaction eligible for payout, per [Sprint 5, Task 5.4](../sprint-05-payments/task-4-tutor-earnings-dashboard.md).
