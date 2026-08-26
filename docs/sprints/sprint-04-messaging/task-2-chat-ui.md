# Task 4.2 — Chat UI (Mobile + Web)

**Sprint:** 4 — In-App Messaging
**Estimate:** 3 days

## Goal

User-facing chat screens, using Stream's SDKs to minimize custom real-time UI work.

## Scope

- Mobile: Stream Chat Flutter SDK integrated, themed to match the [design system](../sprint-00-foundation/task-5-design-system.md).
- Web: Stream Chat React SDK integrated into `apps/web` (and `apps/admin` for moderation view in [Task 4.4](task-4-chat-moderation-persistence.md)), themed consistently.
- Chat entry points: from a booking detail screen ([Sprint 3, Task 3.4](../sprint-03-booking/task-4-booking-calendar-views.md)) and from a conversation list screen.
- Typing indicators, read receipts, unread badge counts (Stream provides these natively — wire, don't rebuild).
- Push notification tap deep-links into the correct conversation.

## Acceptance Criteria

- [ ] Chat is reachable from a booking detail screen and shows correct message history.
- [ ] Sending a message on one device appears in real time on the other party's device.
- [ ] Unread counts are accurate and clear across app navigation.
- [ ] Chat UI is visually consistent with the rest of the app's design system, not an unstyled default SDK look.

## Technical Notes

- Prefer Stream's prebuilt UI components over fully custom chat UI to keep this task within a 3-day estimate — customize theming, not core interaction patterns.

## Dependencies

- [Task 4.1 — Real-Time Chat Backend Integration](task-1-chat-backend-integration.md)
