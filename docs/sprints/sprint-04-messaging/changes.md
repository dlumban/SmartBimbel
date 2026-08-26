# Sprint 4 — Changes Log

Status: **Complete**. All 4 tasks built and verified. Stream Chat itself isn't provisioned in this environment (no `STREAM_API_KEY`/`STREAM_API_SECRET` - same situation as Firebase/SendGrid/WhatsApp before it) - per an explicit decision the user made when asked, the backend and frontend both implement the real Stream integration and gate gracefully rather than building a parallel self-hosted chat system. What that means concretely, and what's genuinely testable versus structurally-correct-but-inert, is spelled out per task below.

## Task 4.1 — Real-Time Chat Backend Integration

- `StreamChatService`: thin wrapper around the Stream Chat Node SDK, same lazy-init/clear-503 pattern as `FirebaseAdminService` - every method throws `ServiceUnavailableException` until `STREAM_API_KEY`/`STREAM_API_SECRET` are configured, never a silent no-op that could mask a real production misconfiguration.
- `Conversation` (already scaffolded in Sprint 0's schema) is now created automatically inside the same transaction as `POST /bookings` (Task 3.2) - a real, always-present DB row regardless of Stream's availability. The Stream *channel* behind it is created best-effort just after that transaction commits (`ChatService.createChannelForBooking`), storing the resulting `cid` on `Conversation.streamChannelId`; a failure here (expected in this environment) never fails booking creation.
- `GET /bookings/:id/chat/token`: verifies the requester is one of the booking's two participants **before** ever calling Stream, so the "only participants can access this channel" acceptance criterion is enforced at our API boundary and is genuinely testable here (403 for a third party) even though the subsequent token generation itself 503s (Stream unconfigured) - both behaviors are covered by e2e tests against the real, unconfigured `StreamChatService`.
- `POST /chat/webhook`: receives Stream's `message.new` events, verifies the HMAC signature via `req.rawBody` (enabled globally via `NestFactory.create(..., { rawBody: true })`) when Stream is configured, and mirrors the message into our own `Message` table (idempotent via a unique `streamMessageId`, so a retried delivery can't double-insert) - this is what lets messages sent through a live Stream client ever show up in our own persistence/moderation layer once credentials exist.
- New models: `Conversation.streamChannelId`, `Message.streamMessageId`, plus `MESSAGE_RECEIVED` added to `NotificationType` - every message (sent via our own endpoint or mirrored from Stream) notifies the recipient through the existing Task 3.6 notifications pipeline.
- **Real bug found and fixed during this task**: overriding a BullMQ queue token in an e2e test without also overriding its `@Processor` class breaks that processor's real Worker (`"Worker requires a connection"`) - this exact issue first surfaced in Sprint 3 and recurred here the moment `SESSION_REMINDER_QUEUE`'s token was touched in `bookings.e2e-spec.ts` again for an unrelated reason; fixed the same way (processor override alongside the queue override) and reconfirmed the rule as standing convention.

## Task 4.2 — Chat UI (Web)

- `ChatPanel`: renders the live thread via Stream's prebuilt React components (`Chat`/`Channel`/`Window`/`MessageList`/`Thread`, plus `MessageComposerUI` - Stream Chat React v14 replaced the older `MessageInput` component with a new composer architecture, caught by an actual `next build` failure after the component had already passed a fully-mocked unit test, a reminder that mocking the entire SDK in tests can hide real import/API-surface breakage that only a real build catches). Fetches a token via Task 4.1's endpoint first; a 503 (Stream not configured - the real state in this environment) renders a clear "Obrolan belum tersedia" state instead of a broken/blank screen.
- Entry point: a "Buka Obrolan" link on the booking detail screen ([Sprint 3, Task 3.4](../sprint-03-booking/task-4-booking-calendar-views.md)) routing to `/bookings/:id/chat`. A separate "conversation list" screen was not built - every booking has exactly one conversation, and `BookingList` already serves as that list (the same reasoning Task 3.7 applied to the "request inbox" requirement), so a second, redundant list view was skipped.
- Typing indicators / read receipts / unread counts are wired through Stream's own components and context (not rebuilt) per the task's technical note - real code, inert here for the same reason the thread itself is.
- **Acceptance criterion not met, documented rather than faked**: "tapping a booking-related push notification deep-links into the correct conversation." Same root cause as Sprint 3 Task 3.7's identical gap - no device-token registration flow exists anywhere in the app yet (`PushChannelAdapter` always skips), so there is no real push to tap. The deep-link target itself is correct and working (`/bookings/:id/chat`, and every `MESSAGE_RECEIVED` notification's data payload already carries `bookingId`).

## Task 4.3 — Meeting Link & Location Sharing

- `Booking.meetingLink` / `meetingAddress` / `meetingSetByUserId` / `meetingSetAt` - stored directly on the booking record per the task's explicit technical note ("don't rely on scraping chat history"), not a structured chat message type, so [Sprint 6's "Join Meeting" button](../sprint-06-sessions-reviews/task-2-join-meeting-button.md) has a reliable field to read later.
- `PATCH /bookings/:id/meeting`: either participant can set it; which field applies is derived from the booking's own `mode` (`ONLINE` requires `meetingLink`, `OFFLINE` requires `meetingAddress`) rather than a separate mode flag on the request.
- URL validation (`isValidMeetingLink`, `packages/shared`) requires `https://` and a `zoom.us`/`meet.google.com` host - shared by both the backend (source of truth) and the web form (inline validation before submit), so the two can't drift, matching the pattern already established for `FREE_CANCELLATION_WINDOW_HOURS` in Sprint 3.
- `MeetingInfoSection` (editable, lives on the chat page) and a read-only summary on the booking detail screen both render the same data - satisfies "visible in both the chat thread and the booking detail screen" without duplicating the edit UI in two places.

## Task 4.4 — Chat Moderation & Message Persistence

- `MessageReport` (references a specific message, or just the other participant with `messageId: null`) and `ConversationBlock` (scoped to one conversation, not platform-wide, per the task's explicit MVP scope) - both real Postgres tables, both enforced server-side: `ChatService.sendMessage` checks for an active block before persisting, `reportMessage` rejects reporting your own message.
- Message history is retrievable by booking id (`GET /bookings/:id/messages`, paginated) directly from our own `Message` table - durable and admin-queryable regardless of Stream's configuration state, satisfying "message history retrievable by conversation ID" without depending on Stream's own export API (which isn't reachable to verify in this environment anyway).
- `ChatModerationBar`: Report User / Block User actions plus a persistent on-platform payment/communication reminder, addressing PRD §12's payment-friction risk - all wired to the always-functional REST endpoints above, independent of whether the live Stream thread renders.
- Reporting an *individual* Stream-rendered message (vs. the general "report this user" action) would need Stream's message-action-menu customization API to inject a custom action - real, valuable, but meaningfully more work for something inert in this environment; the backend endpoint (`POST /bookings/:id/messages/:messageId/report`) is built and tested, the frontend surface for it is deferred alongside the rest of the live-Stream-dependent UI.

---

## Final verification (whole workspace, this sprint)

- `pnpm build` — clean across all packages, including the new `/bookings/[id]/chat` route (528 kB / 660 kB first load - the Stream Chat React bundle, code-split to its own route so it doesn't affect any other page's load size).
- `pnpm lint` / `pnpm typecheck` — clean.
- API: 158 unit tests + 108 e2e tests (up from 123/90 at the end of Sprint 3), all passing against the real DB, including a dedicated `chat.e2e-spec.ts` (participant access control, real 503 on token generation, message send/list/report/block, and the Stream webhook mirror-in path).
- Web: 97 component tests (up from 81 at the end of Sprint 3).
- Live smoke test: booted `pnpm dev` (killed a stray `next-server` process left over from an earlier session by PID directly - `TaskStop` alone doesn't reliably terminate this process tree in this environment, now the second time this has come up), confirmed `/`, `/bookings`, and `/bookings/[id]/chat` all compile and respond `200` with no runtime errors.

## Known deferred items (not blockers, tracked for later sprints)

- Live Stream Chat itself: token generation, channel creation, and the realtime thread all 503/render-unavailable until `STREAM_API_KEY`/`STREAM_API_SECRET` are provisioned (Task 0.6). The architecture is real and complete; only credentials are missing.
- Push-notification tap-to-deep-link (Task 4.2): blocked on the same FCM web SDK + device-token registration flow flagged as a gap in Sprint 3, Task 3.7.
- Per-message "report" action inside the live Stream thread's own message UI (Task 4.4) - the backend endpoint exists and is tested; the frontend surface is deferred until Stream is live and its message-action customization can be wired for real. "Report the other participant" (no specific message) is fully wired today.
- A mobile (Flutter) Stream Chat integration is out of scope per the user's earlier "web-first, defer mobile" decision (Sprint 0).
