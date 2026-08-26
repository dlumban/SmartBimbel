# Task 7.5 — Dispute Resolution Tools

**Sprint:** 7 — Admin Panel
**Estimate:** 2.5 days

## Goal

Replace the internal-endpoint stopgap from [Sprint 5, Task 5.6](../sprint-05-payments/task-6-refund-dispute-handling.md) with a real dispute review UI, per PRD §6.1.H.

## Scope

- Dispute queue: `OPEN`/`UNDER_REVIEW` disputes with booking context (both parties' profiles, booking details, chat history reference, no-show/cancellation flags from [Sprint 3](../sprint-03-booking/task-5-reschedule-cancellation-rules.md)).
- Resolution action: mark `RESOLVED_REFUND` (triggers the refund mechanics built in [Task 5.6](../sprint-05-payments/task-6-refund-dispute-handling.md)) or `RESOLVED_NO_REFUND`, with resolution notes.
- Reported chat messages/users from [Sprint 4, Task 4.4](../sprint-04-messaging/task-4-chat-moderation-persistence.md) surfaced here too, since they're a related trust-and-safety input even if not always tied to a formal dispute.
- SLA visibility: how long a dispute has been open, to help support staff prioritize.

## Acceptance Criteria

- [ ] Admin can see full context for a dispute (booking, both parties, relevant flags/history) without needing to query the database directly.
- [ ] Resolving with refund correctly triggers the refund flow from [Task 5.6](../sprint-05-payments/task-6-refund-dispute-handling.md) and updates all related records.
- [ ] Reported chat content from Sprint 4 is visible and actionable (e.g. can escalate to a formal dispute or user suspension) from this same area.
- [ ] Both parties are notified of the resolution outcome.

## Dependencies

- [Task 7.1 — Admin Panel Foundation & RBAC](task-1-admin-panel-foundation-rbac.md)
- Sprint 5: [Refund & Dispute Handling](../sprint-05-payments/task-6-refund-dispute-handling.md)
- Sprint 4: [Chat Moderation & Message Persistence](../sprint-04-messaging/task-4-chat-moderation-persistence.md)
