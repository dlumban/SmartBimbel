# Task 4.3 — Meeting Link & Location Sharing in Chat

**Sprint:** 4 — In-App Messaging
**Estimate:** 1.5 days

## Goal

PRD §6.1.D explicitly calls for sharing Zoom/Google Meet links or offline addresses within chat, since MVP uses external video tools rather than in-app video (PRD §9).

## Scope

- Structured message type (or a simple pinned-field on the `Booking`/`Conversation`) for "meeting link" (online sessions) or "meeting address" (offline sessions), settable by either party, visible to both.
- Quick-action button in chat UI to add/edit the meeting link or address for the associated booking.
- Surface the meeting link/address prominently on the booking detail screen too, not buried in chat history (this feeds directly into [Sprint 6, Task 6.2's](../sprint-06-sessions-reviews/task-2-join-meeting-button.md) "Join Meeting" button).
- Basic URL validation for meeting links (must be a valid Zoom/Meet-style URL) to catch typos before session time.

## Acceptance Criteria

- [ ] Either party can set/update a meeting link (online) or address (offline) tied to the booking.
- [ ] The link/address is visible in both the chat thread and the booking detail screen.
- [ ] Invalid URLs are rejected with a clear error rather than silently saved.
- [ ] This data is available for [Sprint 6](../sprint-06-sessions-reviews/task-2-join-meeting-button.md) to build the "Join Meeting" button against.

## Technical Notes

- Storing this as a field on `Booking` (rather than parsing it out of freeform chat messages) makes it reliably retrievable for the "Join Meeting" button later — don't rely on scraping chat history.

## Dependencies

- [Task 4.2 — Chat UI](task-2-chat-ui.md)
- Sprint 3: [Booking Request Flow](../sprint-03-booking/task-2-booking-request-flow.md) (`Booking` record to attach the link to)
