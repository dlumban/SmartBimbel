# Sprint 3 — Changes Log

Status: **Complete**. All 7 tasks built and verified against the real local Postgres/Redis, with real BullMQ queues (mocked only where a real Worker would otherwise hang test teardown — see the BullMQ note below). One acceptance-criterion item (push-notification tap-to-deep-link, Task 3.7) is structurally supported but not end-to-end testable in this environment — documented in Task 3.7 below, not silently marked done.

## Task 3.1 — Tutor Availability Management

- `AvailabilitySlot` CRUD scoped to `tutors/me/availability`: recurring (`dayOfWeek`) or one-off (`date`) slots, `startTime`/`endTime` as `"HH:mm"` strings in the tutor's local time.
- Overlap detection (`rangesOverlap`/`toMinutes`/`dayOfWeekOf` helpers) rejects a new slot that overlaps an existing one on the same day, including a one-off slot overlapping a recurring slot that falls on the same weekday.
- Editing/deleting a slot with an active booking is blocked (409) — a data-integrity guard distinct from the booking-availability display logic in Task 3.2/2.4.
- Web: `AvailabilityManager` (weekly/one-off toggle, day/date + time pickers, list with a "Terpesan" badge on booked slots) at `/dashboard/availability`.

## Task 3.2 — Booking Request Flow (Backend)

- `POST /bookings`: row-locks the target `AvailabilitySlot` (`SELECT ... FOR UPDATE` inside a `$transaction`) so two concurrent requests against the same slot+date can't both succeed — verified with a genuine concurrency test firing simultaneous requests and asserting exactly one `201`/one `Booking` row.
- `packages/shared/src/timezone.ts`: real WIB/WITA/WIT conversion (`combineLocalDateTimeToUtc`), including day-rollover cases (e.g. WIT 07:00 local = UTC 22:00 the previous day) — booking creation converts the tutor's local slot time to a UTC `scheduledAt` using this, not ad hoc math.
- `BullMQ`-backed 24h response-expiry job (`booking-expiry` queue): a `REQUESTED`/`COUNTER_PROPOSED` booking auto-expires if the tutor never responds, idempotent (re-checks `respondByAt` against the DB at fire time rather than trusting the job's delay alone).
- **Critical bug found and fixed**: the "is this slot occupied" check (booking creation) and the "hide booked slots" filter (tutor discovery) were both scoped only by `availabilitySlotId`, so a recurring "every Tuesday" slot became permanently unavailable/hidden after just *one* Tuesday was booked. Fixed by scoping the active-booking conflict check to `(availabilitySlotId + scheduledAt)` and changing the discovery filter to always show recurring slots (only a one-off slot has exactly one possible occurrence, so hiding it once booked is correct). Reasoned from PRD §6.2 explicitly listing "recurring bookings" as Post-MVP — confirms each `Booking` is a single-occurrence booking against a possibly-recurring template.
- **Test-infra bug found and fixed**: a `@Processor`-decorated class (`BookingExpiryProcessor`) starts a *real* BullMQ `Worker` with its own Redis connection during `app.init()` regardless of whether its `Queue` token is mocked — overriding only the queue wasn't enough and caused e2e test hangs. Fixed by also overriding the processor class itself (`.useValue({})`) in every e2e spec file. This pattern recurred twice more this sprint (Tasks 3.5 and 3.6 each added new queues/processors) and is now the standing convention for every e2e file that boots the full `AppModule`.
- **Test-infra bug found and fixed**: `jest-e2e.json` had no `maxWorkers` setting, so Jest ran multiple e2e spec files in parallel against the *same* real Postgres database — occasionally racing (e.g. `admin-tutors.e2e-spec.ts` verifying a tutor mid-run while `discovery.e2e-spec.ts` asserted an exact sorted price list). Fixed with `"maxWorkers": 1`, making the suite fully serial and deterministic.

## Task 3.3 — Booking Accept / Decline / Counter-Propose

- Explicit state-transition table (`booking-state-machine.ts`) rather than scattered `if`s — `resolveBookingTransition(from, action, actor)` is the single source of truth, extended again by Tasks 3.5's reschedule/cancel actions.
- `PATCH /bookings/:id/accept|decline|counter-propose`, all enforcing the transition table server-side (a 400 for any illegal move, e.g. accepting an already-declined booking).
- `BookingStatusHistory`: an immutable audit row (`fromStatus`, `toStatus`, `changedByUserId`, `reason`, `createdAt`) written on every transition, exposed via `GET /bookings/:id/history` — the audit trail Sprint 5/7's dispute tooling will read from.
- `NotificationsModule` introduced (in-app `Notification` row only at this point; Task 3.6 adds real delivery) — booking code calls `NotificationsService.send()`, never a channel SDK directly.
- **Real bug found and fixed**: `packages/shared`'s `ACTIVE_BOOKING_STATUSES` (used by Task 3.1's availability module and Task 2.4's discovery filter) predated `COUNTER_PROPOSED` and was never updated when this task introduced it — a slot with a pending counter-offer was incorrectly treated as free/editable. Fixed the shared constant and added a regression test.

## Task 3.4 — Booking Calendar Views

- `GET /bookings?bucket=upcoming|past|cancelled&page=&limit=`: bucketing logic lives in one backend query (`BookingsService.bucketWhere`), not duplicated per-client, per the task's own technical note. `upcoming` = active statuses with a future `scheduledAt`; `past` = `COMPLETED` or an active status whose time has passed; `cancelled` = `DECLINED`/`EXPIRED`/`CANCELLED`.
- Response shape matches the existing tutor-discovery pagination convention (`{ data, total, page, limit }`).
- Web: `BookingList` (tab bar, status badges, pagination controls, per-bucket empty states) and `BookingDetail` (status, schedule, role-appropriate actions) at `/bookings` and `/bookings/:id`.

## Task 3.5 — Reschedule & Cancellation Rules Engine

- **Product decision made explicit, not guessed**: PRD §14 flags the cancellation window as an open question ("12–24 hours" as an example, not final). Asked the user directly; **24 hours** was confirmed and is now `FREE_CANCELLATION_WINDOW_HOURS` in `packages/shared` (imported by both the backend rule and the web cancellation-preview UI, so they can never drift).
- `PATCH /bookings/:id/cancel`: available to either participant from any active status. A booking that was never confirmed (`REQUESTED`/`COUNTER_PROPOSED`) is always a free withdrawal; an `ACCEPTED`/`RESCHEDULE_PROPOSED` booking is flagged `isLateCancellation` if cancelled inside the 24h window — snapshotted at cancel time (not derived later) since a rescheduled booking's `scheduledAt` isn't stable. No fee is charged (payments don't exist until Sprint 5) — this is the data record future enforcement reads from, per the task's own technical note.
- `PATCH /bookings/:id/reschedule` (propose) + `/reschedule/accept` + `/reschedule/decline`: new `RESCHEDULE_PROPOSED` status, distinct from `COUNTER_PROPOSED` (which only exists pre-acceptance and whose decline ends the booking entirely — declining a reschedule just keeps the original time). Unlike the tutor-only counter-propose flow, either party can propose a reschedule, so `rescheduleProposedByUserId` is tracked explicitly to stop the proposer from "accepting" their own proposal — enforced server-side, tested via a dedicated e2e case.
- `PATCH /bookings/:id/no-show`: a lightweight flag (`noShowReported`, `noShowReportedByUserId`, `noShowReportedAt`) on an `ACCEPTED` booking whose session time has passed — feeds Sprint 7's dispute tooling later, deliberately not a status transition.
- Cancellation reason capture: `CancellationReasonCode` enum (dropdown) + optional free-text `details`, both stored, both surfaced in the UI.

## Task 3.6 — Notification System Integration

- `NotificationsService.send()` now does two things: persists the in-app `Notification` row (Task 3.3) *and* enqueues an async, retryable delivery job (`notification-delivery` queue, 3 attempts with exponential backoff) — delivery failures never propagate back to fail the booking API call that triggered them, per the task's acceptance criterion.
- Channel adapter interface (`NotificationChannelAdapter`) with three implementations — **honest about what's real in this environment, mirroring how `FirebaseAdminService`/`StorageService` already handle unprovisioned third-party services**:
  - `EmailChannelAdapter` (SendGrid) and `WhatsAppChannelAdapter` (BSP, endpoint TBD per Task 0.6) both make a real HTTP call *if* configured, and cleanly log-and-skip (never throw) when the API key or recipient contact is missing — "unconfigured" is a permanent condition, not something BullMQ retries can fix.
  - `PushChannelAdapter` **always** skips: there is no device-token registration flow anywhere in the app (no browser push-permission prompt, no FCM token storage) for it to send to, regardless of credentials. This is a real, documented gap — not a stub pretending to work. Building fake plumbing with no genuine trigger was rejected in favor of documenting exactly what's missing (an FCM web SDK + service worker + token-storage flow) for whoever provisions Firebase and picks this up.
- Session reminders: accepting a booking (initial accept, or a reschedule accepting a new time) schedules two delayed jobs (24h-before, 1h-before) on a new `session-reminder` queue. The processor re-checks the booking is still `ACCEPTED` and that `scheduledAt` still matches what the reminder was scheduled against, so a since-cancelled or since-rescheduled session's stale reminder is a no-op rather than firing incorrectly.
- WhatsApp opt-out: `User.whatsappOptOut`, `PATCH /users/me/notification-preferences` — filtered at delivery time (not enqueue time) so a preference change between enqueue and delivery is always respected; push/email are never optional in MVP, per the task's scope.
- No frontend toggle UI was built for this preference (the API alone satisfies the acceptance criterion — "a user who disables WhatsApp stops receiving them"); a settings-page toggle is straightforward follow-up work whenever a general account-settings page exists.

## Task 3.7 — Booking Flow UI

- `NewBookingForm` (`/bookings/new?tutorId=...`) replaces Sprint 2's stub: real slot picker sourced from the tutor's actual `availabilitySlots` (recurring slots resolve to their next real calendar occurrence via UTC-consistent date math, matching exactly how the backend parses `scheduledDate`), subject/mode/duration selection constrained to what the tutor actually offers, notes, submit → `POST /bookings` → redirect to the new booking's detail page.
- **Real gap found and fixed**: `TutorDetail` (Task 2.4's shared discovery type) only ever exposed subject *names* (`subjects: string[]`), not ids — insufficient to submit `CreateBookingDto.subjectId`. Added a parallel `subjectOptions: { id, name }[]` field (additive, doesn't disturb the widely-used names-only list shape) to both the shared type and the backend's `getPublicDetail()`.
- `BookingDetail`'s cancel panel now previews the free/late cancellation outcome *before* the user confirms (the task's explicit acceptance criterion), using the same shared `FREE_CANCELLATION_WINDOW_HOURS` constant as the backend.
- Tutor-side "request inbox" and student-side pending-request states are the existing `BookingList`/`BookingDetail` from Task 3.4/3.5 — a `REQUESTED` booking surfaces in the Upcoming tab and its detail view already carries the correct role-appropriate actions; no separate inbox screen was needed.
- All 8 `BookingStatus` values (including `CONFIRMED`/`COMPLETED`, not reachable until Sprints 5/6) have a label and badge variant — no state renders as a blank/broken UI.
- **Acceptance criterion not met, documented rather than faked**: "tapping a booking-related push notification deep-links to the correct booking detail screen." There is no real push notification to tap in this environment (see Task 3.6's `PushChannelAdapter` gap) — no FCM web SDK, no service worker, no permission prompt, no device-token registration. The deep-link *target* is real and already correct (every notification's `data` payload carries `bookingId`, and `/bookings/:id` is the canonical, working URL) — what's missing is the push-delivery-to-tap plumbing itself, which depends on real Firebase credentials this environment doesn't have. Flagged for whoever provisions Firebase, not silently marked done.

---

## Final verification (whole workspace, this sprint)

- `pnpm build` — clean across all packages, including full static prerender (`/bookings`, `/bookings/new`, `/bookings/[id]` all present in the route manifest).
- `pnpm lint` / `pnpm typecheck` — clean.
- API: 123 unit tests + 90 e2e tests (up from 85/74 at the end of Task 3.2), all passing against the real DB, run serially (`maxWorkers: 1`) for determinism.
- Web: 81 component tests (up from 63 at the end of Task 3.4), all passing.
- Live smoke test: booted `pnpm dev` (after finding and killing a stale server process left over from an earlier smoke test — `TaskStop` on the harness side doesn't reliably kill the underlying `next-server` process tree in this environment, worth remembering for future sessions), confirmed `/`, `/bookings`, `/bookings/[id]`, and `/bookings/new` all compile and respond `200` with no runtime errors.

## What's genuinely ready for Sprint 4

Messaging (Sprint 4) can build directly on: a `Conversation`/`Message` schema already scaffolded (Sprint 0), a real `Booking` entity with a stable id to key a conversation off of, and the `NotificationsService`/channel-adapter infrastructure from Task 3.6 ready to reuse for message notifications without inventing new plumbing.

## Known deferred items (not blockers, tracked for later sprints)

- Push notification delivery (`PushChannelAdapter`) and tap-to-deep-link (Task 3.7): blocked on FCM web SDK + device-token registration flow, which needs real Firebase credentials.
- WhatsApp/email delivery (`WhatsAppChannelAdapter`/`EmailChannelAdapter`): architecture and retry logic are real and tested; actual delivery is blocked on SendGrid/WhatsApp BSP credentials (Task 0.6).
- A frontend settings-page toggle for the WhatsApp opt-out preference (API exists, no UI yet).
- `CONFIRMED` and `COMPLETED` booking statuses are modeled and rendered correctly but not yet reachable — Sprint 5 (payment) and Sprint 6 (session completion) wire up the transitions into them.
