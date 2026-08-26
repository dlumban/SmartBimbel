# Sprint 6 — Changes Log

Status: **Complete**. All 5 tasks built and verified. Unlike every prior sprint, nothing here is gated behind an unprovisioned third-party credential - session lifecycle, meeting links, notes, reviews, and rating aggregation are all our own data and logic, so everything described below is genuinely live and end-to-end tested against the real database.

## Task 6.1 — Session Lifecycle & "Mark Complete" Flow

- `PATCH /bookings/:id/complete`: **tutor-only** (product decision, documented here per the task's own note) - the tutor is the party physically leading/present at the session, matching MVP trust levels; student confirmation was considered but adds friction without a clear trust benefit at this stage. Only legal on a `CONFIRMED` booking whose scheduled end time (`scheduledAt + durationMinutes`) has already passed - can't pre-emptively complete (and unlock payout eligibility for) a session that hasn't happened yet.
- Auto-complete safety net (`SessionAutoCompleteProcessor`, `SESSION_AUTO_COMPLETE_QUEUE`): scheduled by `PaymentsService` the moment a booking is actually confirmed (paid) via the Midtrans webhook - not at acceptance time, since only a paid session can legitimately reach `COMPLETED`. Fires `SESSION_AUTO_COMPLETE_GRACE_HOURS` (24h, documented product decision) after the session's scheduled end; idempotent no-op if the tutor already completed it manually or the booking moved on some other way. This is the same delayed-BullMQ-job pattern as booking/payment expiry (Tasks 3.2/5.2) - genuinely scheduled and unit/e2e-tested for correct delay and no-op behavior, but the real multi-hour wait itself isn't live-observable in a test run, exactly like those precedents.
- Completing a session (either path) sends the student a `REVIEW_PROMPT` notification and, since payout eligibility (Sprint 5, Task 5.4) already keys off `booking.status === "COMPLETED"`, immediately makes the transaction payout-eligible with no separate wiring needed.
- Dashboard visibility ("today's/upcoming sessions clearly surfaced"): already satisfied by Sprint 3's existing `bucket=upcoming` booking list (`CONFIRMED` is and always was part of `ACTIVE_BOOKING_STATUSES`, sorted soonest-first) - no new dashboard screen was needed for this AC.
- **Real bug found and fixed**: `reportNoShow` (Sprint 3) only allowed `ACCEPTED` bookings, but Sprint 5 introduced `CONFIRMED` as the state a paid booking normally sits in by the time its session actually happens (`ACCEPTED` only lasts until payment). Left as-is, no-show reporting would have been unreachable for the entire normal paid-booking path. Fixed to accept both `ACCEPTED` and `CONFIRMED`, on both the backend and the booking detail screen's button visibility.

## Task 6.2 — "Join Meeting" Button & External Link Handling

- Replaced the old read-only meeting-link text on the booking detail screen with `JoinMeetingSection`: a real "Gabung Sesi" button (`target="_blank"` to the stored Zoom/Meet URL) for online sessions, or "Buka di Peta" (Google Maps search URL - `https://www.google.com/maps/search/?api=1&query=...`, no API key needed for this URL scheme, unlike Sprint 2's Places Autocomplete) for offline sessions.
- Time-aware per the task's AC: the button is always clickable (never dead) once a link/address exists, but switches to the `primary` (vs. `secondary`) visual variant starting `JOIN_MEETING_HIGHLIGHT_MINUTES_BEFORE` (10 min, documented constant) before the scheduled start through the scheduled end.
- No link/address set: a clear prompt ("Belum ada link pertemuan") linking into the chat page rather than a broken or missing button - the actual place a link gets set is still Sprint 4's `MeetingInfoSection` inside chat.

## Task 6.3 — Post-Session Notes

- `Booking.sessionNotes` / `sessionNotesUpdatedAt`; `PATCH /bookings/:id/notes` - tutor-only, gated to a `COMPLETED` booking per the task's own AC wording ("add post-session notes on a completed booking").
- `SessionNotesSection`: editable for the tutor, read-only for the student, single free-text field only - deliberately not a structured progress-report model, which is explicitly PRD §6.2/Phase 2 scope per the task's technical note.
- Blank notes never block completion, payout, or review - there's no validation coupling `sessionNotes` to any other field.

## Task 6.4 — Ratings & Reviews System

- `Review.flagged` added; `POST /bookings/:id/review` - student-only (one-directional per PRD §6.1.G's confirmed reading; a tutor attempting to review gets 403), only legal once the booking is `COMPLETED`.
- One review per booking is enforced structurally (`Review.bookingId @unique`) rather than by an extra check - the endpoint upserts: a first submission creates, a resubmission within `REVIEW_EDIT_WINDOW_HOURS` (48h, documented constant) overwrites the same row, and a resubmission past that window is rejected with a clear error. This reconciles the task's two stated requirements ("second review is rejected" + "editable within a short window, then locked") - within the window it's an edit, not a "second" review in the sense the AC means; past the window, resubmission genuinely is rejected.
- Simple keyword filter (`FLAGGED_KEYWORDS`, Bahasa Indonesia + English basics) sets `Review.flagged` on a match but never blocks submission - the task's own scope explicitly calls for "basic... as a first pass," avoiding false-positive censorship without a human look (full moderation UI is Sprint 7, Task 7.5, matching the same `/internal` stopgap precedent Sprint 5 established for payouts/disputes).
- `REVIEW_PROMPT` notification sent to the student on every completion path (manual and auto-complete), satisfying "review submission is prompted... via notification."

## Task 6.5 — Tutor Profile Rating Aggregation Display

- `TutorProfile.averageRating` / `reviewCount` recomputed synchronously on every non-flagged `Review` write (`ReviewsService.recomputeTutorRating`) - fine at MVP write volume per the task's own technical note, and means the aggregate is always exactly consistent with the underlying `Review` rows (no async drift window).
- Replaced Sprint 2's `rating: null` placeholder in `TutorsService.toListItem` with the real field, and wired `sort=rating` to `{ averageRating: { sort: "desc", nulls: "last" } }` - explicit `nulls: "last"` matters here: Postgres's own default for `DESC` is `NULLS FIRST`, which would otherwise rank every never-reviewed tutor above a genuinely well-rated one.
- New `GET /tutors/:id/reviews` (public, paginated, excludes `flagged` reviews) backs the tutor detail page's "Ulasan" section, replacing Sprint 2's static "Belum ada ulasan" placeholder with real reviewer name/rating/text.
- Flagged reviews are excluded from both the aggregate average and the public reviews list - verified by a dedicated e2e test (a flagged review saves successfully but leaves `rating: null`/`reviewCount: 0` and never appears in the list) until an admin clears the flag (Sprint 7 tooling, not built here).

---

## Final verification (whole workspace, this sprint)

- `pnpm build` — clean across all packages.
- `pnpm lint` / `pnpm typecheck` — clean.
- API: 246 unit tests (up from 224 at the end of Sprint 5 - new `ReviewsService` and `SessionAutoCompleteProcessor` specs, plus additions to `BookingsService`'s and `PaymentsService`'s existing suites) + 148 e2e tests (up from 135 - one new `sessions-reviews.e2e-spec.ts` covering completion/notes/reviews/rating aggregation end to end, plus the two Sprint 5 payment e2e files updated to override the new `SESSION_AUTO_COMPLETE_QUEUE`/`SessionAutoCompleteProcessor` pairing now that `PaymentsService` depends on it), all passing against the real DB.
- Web: 142 component tests (up from 118) - four new components (`JoinMeetingSection`, `SessionCompletionSection`, `SessionNotesSection`, `ReviewSection`), updates to `TutorDetailView.spec.tsx` for the real reviews list, and 6 new integration tests added to `BookingDetail.spec.tsx` covering the new sections' visibility rules.
- Live smoke test: booted `pnpm dev`, confirmed `/`, `/bookings`, `/tutors`, and `/bookings/[id]` all compile and respond `200`; confirmed `PATCH .../complete`, `PATCH .../notes`, and `POST .../review` all correctly 401 without auth against the real running server, and `GET /tutors/:id/reviews` correctly 200s unauthenticated (public route); confirmed no unexpected errors/warnings in the dev-server logs. Manually killed the surviving `next-server`/`next dev`/`nest start` processes by PID afterward - `TaskStop` still doesn't reliably terminate this process tree in this environment (fourth sprint in a row).

## Known deferred items (not blockers, tracked for later sprints)

- The auto-complete safety net's actual multi-hour delayed firing isn't live-observable in a test run (same limitation as booking/payment expiry in Sprints 3/5) - the scheduling call and the processor's own idempotent logic are both directly unit/e2e-tested instead.
- Admin review-flag clearing UI for flagged reviews, and the admin dispute/payout processing UIs from Sprint 5: all explicitly Sprint 7 scope (Tasks 7.4/7.5) - the `/internal`-gated mechanics they'll eventually sit behind don't exist yet for reviews (no "internal reviews" endpoint was built this sprint, since nothing in Task 6.4/6.5's scope called for one - Sprint 7 will add it alongside the moderation UI itself).
- Push-notification tap-to-deep-link for `REVIEW_PROMPT`: same pre-existing gap flagged in Sprints 3 and 4 (no device-token registration flow exists yet) - the notification itself fires correctly and carries the right `bookingId`, only the "tap to open" step is inert.
