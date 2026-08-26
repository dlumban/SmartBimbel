# Task 4.1 — Real-Time Chat Backend Integration

**Sprint:** 4 — In-App Messaging
**Estimate:** 3 days

## Goal

Wire up the managed chat provider (Stream Chat, per the architectural decision in the [sprints README](../README.md)) so a `Conversation` is created automatically per booking and both parties can authenticate into it securely.

## Scope

- Stream Chat account/app provisioned (add to [Task 0.6](../sprint-00-foundation/task-6-third-party-accounts.md)'s account list if not already covered).
- Backend: on booking request creation ([Task 3.2](../sprint-03-booking/task-2-booking-request-flow.md)), create a corresponding Stream channel scoped to that booking's two participants; store the channel reference on the `Conversation` record.
- Server-side Stream user token generation endpoint (`GET /chat/token`) so mobile/web clients can authenticate to Stream without exposing the Stream secret key client-side.
- Access control: only the two participants of a booking (plus admin, for moderation in [Sprint 7](../sprint-07-admin-panel/README.md)) can access that channel.
- Webhook handler for Stream events (e.g. message sent) if needed for push notification fan-out via the [notifications module](../sprint-03-booking/task-6-notification-integration.md).

## Acceptance Criteria

- [ ] A `Conversation`/Stream channel is created automatically when a booking request is submitted.
- [ ] Only the booking's two participants can generate a valid token for that channel.
- [ ] A third user (not part of the booking) cannot access the conversation, verified by a test.
- [ ] New messages in a conversation trigger a push notification to the recipient via the existing notifications module.

## Technical Notes

- Using a managed provider (Stream Chat) avoids building/scaling a Socket.io deployment for MVP — trade a per-MAU cost for weeks of infra work. Revisit self-hosting only if cost becomes material post-PMF, per the architectural note in the sprints README.

## Dependencies

- Sprint 3: [Booking Request Flow](../sprint-03-booking/task-2-booking-request-flow.md) (conversation is scoped to a booking)
- Sprint 0: [Database Schema](../sprint-00-foundation/task-4-database-schema.md) (`Conversation`/`Message` models)
