# Sprint 4 — In-App Messaging

**Duration:** 1.5 weeks
**PRD reference:** §6.1.D

## Goal

Enable real-time chat between student/parent and tutor once a booking exists, keeping communication on-platform per PRD §6.1.D.

## Scope

1. [Real-Time Chat Backend Integration](task-1-chat-backend-integration.md)
2. [Chat UI (Mobile + Web)](task-2-chat-ui.md)
3. [Meeting Link & Location Sharing](task-3-meeting-link-location-sharing.md)
4. [Chat Moderation & Message Persistence](task-4-chat-moderation-persistence.md)

## Dependencies

- Sprint 3 complete: a `Booking` must exist to scope a `Conversation` to, per the data model decision in [Task 0.4](../sprint-00-foundation/task-4-database-schema.md).

## Exit Criteria

- A chat thread automatically exists once a booking request is submitted (per PRD §6.1.D: "activated after booking request or confirmation").
- Both parties can send/receive text messages in real time on mobile and web.
- Either party can share a Zoom/Google Meet link or an offline meeting address within the chat.
- Message history persists and is retrievable after app restart/reload.
- Basic moderation (report/block) exists to protect the "keep communication on-platform" goal.
