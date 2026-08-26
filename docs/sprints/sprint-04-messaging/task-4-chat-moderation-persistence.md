# Task 4.4 — Chat Moderation & Message Persistence

**Sprint:** 4 — In-App Messaging
**Estimate:** 1.5 days

## Goal

Protect the "keep communication on-platform" trust goal from PRD §6.1.D with basic reporting/blocking, and ensure message history is durable and admin-visible for future dispute resolution ([Sprint 7](../sprint-07-admin-panel/README.md)).

## Scope

- Report message/user action in chat UI → creates a flagged record for admin review (full admin UI lands in [Sprint 7](../sprint-07-admin-panel/task-5-dispute-resolution-tools.md); this task just needs the flag to be captured and stored).
- Block user action: prevents further messages from a blocked party in that conversation (doesn't need to be a platform-wide block for MVP — scoped to the booking's conversation).
- Confirm Stream's message persistence/export capability covers what's needed for dispute review later (message history retrievable by conversation ID, with timestamps).
- Basic content policy messaging in-app (e.g. a one-line notice discouraging sharing personal payment details outside the platform, addressing the trust/payment-friction risk in PRD §12).

## Acceptance Criteria

- [ ] A user can report a message or the other party; the report is stored with conversation/message reference for later admin access.
- [ ] A blocked party cannot send further messages in that conversation.
- [ ] Message history for any conversation is retrievable by ID for future admin/dispute tooling.
- [ ] In-app messaging includes a visible reminder to keep communication and payment on-platform.

## Technical Notes

- Full moderation tooling (admin review queue, ban management) is explicitly [Sprint 7](../sprint-07-admin-panel/README.md) scope — this task only needs to capture the data, not build the review UI.

## Dependencies

- [Task 4.1 — Real-Time Chat Backend Integration](task-1-chat-backend-integration.md)
