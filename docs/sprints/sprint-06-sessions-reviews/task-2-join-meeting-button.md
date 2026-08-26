# Task 6.2 — "Join Meeting" Button & External Link Handling

**Sprint:** 6 — Session Management & Reviews
**Estimate:** 1 day

## Goal

PRD §6.1.F: "'Join Meeting' button for online sessions (opens external Zoom/Google Meet link)."

## Scope

- Booking detail screen: for online-mode sessions with a meeting link set (via [Sprint 4, Task 4.3](../sprint-04-messaging/task-3-meeting-link-location-sharing.md)), show a prominent "Join Meeting" button that opens the external URL.
- Button is time-aware: enabled/highlighted as the session start time approaches (e.g. active 10 minutes before start), not just always-on.
- For offline-mode sessions, show the meeting address and, where feasible, a "Open in Maps" action using the location integration from [Sprint 2, Task 2.5](../sprint-02-discovery/task-5-location-maps-integration.md).
- Handle the case where no meeting link/address was ever set (shouldn't happen if [Sprint 4](../sprint-04-messaging/README.md) enforced it, but handle gracefully with a prompt to add one via chat).

## Acceptance Criteria

- [ ] Online sessions with a set meeting link show a working "Join Meeting" button that opens the external app/browser.
- [ ] The button's enabled/prominent state responds to proximity to session start time.
- [ ] Offline sessions show the address with a working "open in maps" action.
- [ ] A booking with no meeting link set shows a clear prompt rather than a broken/dead button.

## Dependencies

- Sprint 4: [Meeting Link & Location Sharing](../sprint-04-messaging/task-3-meeting-link-location-sharing.md)
- [Task 6.1 — Session Lifecycle](task-1-session-lifecycle.md)
