# Sprint 5 — Changes Log

Status: **Complete**. All 6 tasks built and verified. Midtrans isn't provisioned in this environment (no `MIDTRANS_SERVER_KEY`/`MIDTRANS_CLIENT_KEY` - same situation as Firebase/SendGrid/WhatsApp/Stream before it, per `docs/third-party-setup.md`) - continuing the "build the real integration, gate gracefully" pattern the user explicitly chose for Sprint 4's Stream Chat, applied here without re-asking since it's now an established convention and, unlike chat, there's no reasonable self-hosted alternative to a payment gateway. What's genuinely live versus structurally-correct-but-inert is spelled out per task below.

## Task 5.1 — Payment Gateway Integration

- `MidtransService`: thin wrapper around the `midtrans-client` SDK (Snap for hosted checkout, Core API for refunds), same lazy-init/clear-503 pattern as `FirebaseAdminService`/`StreamChatService` - every method throws `ServiceUnavailableException` until both keys are configured.
- Webhook signature verification (`verifySignature`) is a plain `SHA512(order_id + status_code + gross_amount + server_key)` hash comparison, implemented directly against Node's `crypto` module (Midtrans's SDK doesn't expose this as a method) - only needs the server key, not a live API connection, so it's fully testable without real credentials given a matching test-only key.
- The community `@types/midtrans-client` definitions only type `CoreApi.charge`, not `CoreApi.transaction.refund` (needed for Task 5.6) - resolved by inspecting the installed package's actual JS source to confirm the real runtime shape, then a narrow local type-cast rather than fighting or replacing the third-party types.
- `NestFactory.create(AppModule, { rawBody: true })` (already enabled in Sprint 4 for Stream's webhook) is *not* needed here - Midtrans signs discrete payload fields, not the raw request body.

## Task 5.2 — Booking Payment Flow

- `Booking.priceAmount` is computed and locked at `POST /bookings` time (`Math.round(hourlyRate * durationMinutes / 60)`), never recalculated from the tutor's live rate - verified by a dedicated e2e test that changes the tutor's `hourlyRate` between booking creation and payment and confirms `priceAmount` is unaffected.
- `POST /bookings/:id/pay`: validates the requester is the booking's own student and the booking is `ACCEPTED` with a price set, then creates (or reuses, on retry) a `PENDING` `Transaction` before calling Midtrans - so even against the real unconfigured `MidtransService`, a retryable ledger row exists and the 503 is the *only* thing standing between this and a working checkout.
- `PaymentsService.handleWebhook` is the **only** place that ever moves a booking `ACCEPTED` → `CONFIRMED` - a client-side Snap redirect is never trusted, matching the task's own technical note. `BookingsService.accept()` now also calls `schedulePaymentExpiry()`, mirroring the existing request-expiry pattern (Task 3.2) with its own `PAYMENT_EXPIRY_QUEUE`/`PaymentExpiryProcessor` (24h window, releases the booking back to `EXPIRED` if unpaid).
- **Real regression found and fixed while running the full e2e suite**: the new `hourlyRate` guard in `BookingsService.create()` (added for this task) broke two pre-existing Sprint 3/4 e2e files (`bookings.e2e-spec.ts`, `chat.e2e-spec.ts`) whose tutor fixtures never set an hourly rate - only unit tests and a generic health-check smoke test had been run after that change, not the full e2e suite. Fixed by adding `hourlyRate: 100000` to both fixtures; confirms the value of the "run everything, not just what you touched" verification step in the sprint workflow.

## Task 5.3 — Platform Commission & Transaction Ledger

- Commission is computed once at `Transaction` creation (`Math.round(amount * rate)`, default 15%, configurable via `PLATFORM_COMMISSION_RATE`) and frozen onto `Transaction.commission` - a later change to the configured rate never rewrites historical transactions. Net-to-tutor (`amount - commission`) is always computed on read, never stored redundantly, so there's exactly one number to keep consistent across the earnings summary, CSV export, and transaction list.
- `GET /transactions`: role-scoped (student sees their payments, tutor sees their bookings' transactions), filterable by status/date range, paginated - covered by an e2e test that confirms a third party never sees another pair's transaction.

## Task 5.4 — Tutor Earnings Dashboard

- `GET /tutors/me/earnings`: `availableBalance` only counts `Transaction`s tied to `COMPLETED`-status bookings (not merely `CONFIRMED`/paid-but-not-yet-taught) - implemented against the *correct*, forward-looking rule from day one even though `COMPLETED` isn't reachable until Sprint 6 lands, rather than taking the task's own permitted "paid = available" shortcut and having to revisit this later. `pendingBalance` covers `CONFIRMED` bookings' net earnings; payouts already `PENDING`/`PROCESSING`/`COMPLETED` are subtracted from `availableBalance` so a tutor can't request the same money twice; the result is floored at zero.
- `GET /tutors/me/earnings/export`: CSV (`Tanggal,Mata Pelajaran,Siswa,Bruto,Komisi,Bersih`), optionally date-ranged via `?from&to`.
- Web: `EarningsDashboard` (summary cards, bank-details form, payout-request form, payout history, CSV date-range + download) at `/dashboard/earnings` (tutor-only, same auth/role-guard pattern as `/dashboard/availability`). CSV download goes through `apiFetch` (needs the auth header) and triggers a `Blob`/`URL.createObjectURL` download rather than a plain `<a href>`.

## Task 5.5 — Payout Request & Processing

- `TutorProfile.bankName/bankAccountNumber/bankAccountHolderName`; `PATCH /tutors/me/bank-details` to set them.
- `POST /payouts/request`: rejects if bank details aren't set, if the amount is below the documented `MINIMUM_PAYOUT_AMOUNT_IDR` (Rp50,000 - a product decision made and documented here, per the task's own note, to avoid excessive small transfers a semi-manual flow can't reasonably absorb), or if it exceeds `EarningsService.getBalanceSummary`'s `availableBalance`. Bank details are snapshotted onto the `Payout` row at request time, so a later profile edit never rewrites payout history.
- Status machine `PENDING → PROCESSING → COMPLETED / FAILED` is linear and one-directional (`VALID_NEXT_STATUSES`), enforced server-side; `FAILED` requires a `failureReason`. Processing itself is admin-approved and manually executed (Midtrans Disbursement API or bank transfer) rather than fully automated - the documented MVP approach per the task's technical note, formalized into real admin tooling in Sprint 7, Task 7.4. For now, `/internal/payouts` (pending queue + status update) reuses the Sprint 1 `/internal` stopgap pattern - no admin frontend was built here, matching the task's own scope boundary.
- Web: bank-details form and payout-request form live in the same `EarningsDashboard` component as Task 5.4 (Task 5.5 depends on 5.4's balance calculation, so keeping them in one screen avoids a round-trip between two pages for what's really one workflow).

## Task 5.6 — Refund & Dispute Handling

- `Dispute` model (`OPEN`/`UNDER_REVIEW`/`RESOLVED_REFUND`/`RESOLVED_NO_REFUND`); `POST /bookings/:id/disputes` lets either participant raise one with a reason, notifying the other party.
- `PATCH /internal/disputes/:id/resolve` (admin-only, same `/internal` stopgap as Task 5.5's payout processing - the real review queue is explicitly Sprint 7, Task 7.5, and was deliberately **not** built here per this task's own technical note): `RESOLVED_NO_REFUND` closes the dispute without touching the transaction; `RESOLVED_REFUND` requires a `PAID` transaction with a `gatewayRef`, calls `MidtransService.refund` (full or partial, `refundAmount` optional and validated ≤ the original paid amount), and only updates `Transaction.status → REFUNDED` after that call succeeds - if Midtrans is unconfigured (the real state here) or the call otherwise fails, the whole resolution throws and the dispute is left `OPEN` rather than silently marked resolved, verified by a dedicated e2e test.
- Both parties are notified on every dispute status change (`DISPUTE_RAISED`, `DISPUTE_RESOLVED`).
- Web: `DisputeSection` on the booking detail screen (raise only, no resolution UI per the task's scope note) - shown to participants once a booking is `CONFIRMED`/`COMPLETED` or has a reported no-show, since raising a dispute only makes sense once money or a session outcome is actually in question.

---

## Final verification (whole workspace, this sprint)

- `pnpm build` — clean across all packages, including the new `/dashboard/earnings` web route.
- `pnpm lint` / `pnpm typecheck` — clean.
- API: 223 unit tests (up from 191 before this sprint's new `EarningsService`/`PayoutsService`/`DisputesService` specs) + 135 e2e tests (up from 108 - two new files, `payments.e2e-spec.ts` against the real unconfigured `MidtransService` and `payments-webhook.e2e-spec.ts` against a deterministic fake gateway for the full pay → webhook → `CONFIRMED` and refund flows), all passing against the real DB. Running the full suite (not just the new files) caught and fixed the `hourlyRate` regression noted under Task 5.2.
- Web: 118 component tests (up from 97), including new specs for `PaymentSection`, `DisputeSection`, `EarningsDashboard`, and 4 new integration tests added to the existing `BookingDetail.spec.tsx` covering the new payment/dispute sections' visibility rules.
- Live smoke test: booted `pnpm dev`, confirmed `/`, `/bookings`, `/dashboard/earnings`, and `/bookings/[id]` all compile and respond `200`; confirmed `/api/transactions`, `/api/tutors/me/earnings`, `/api/payouts/request`, and `/api/internal/disputes` all correctly 401 without auth against the real running server (not just tests); confirmed the dev-server logs had no unexpected errors/warnings beyond the expected "Midtrans not configured" notices. Manually killed the surviving `next-server`/`next dev`/`nest start` processes by PID afterward - `TaskStop` still doesn't reliably terminate this process tree in this environment (third sprint in a row this has come up).

## Known deferred items (not blockers, tracked for later sprints)

- Live Midtrans itself: Snap checkout creation, webhook signature verification against a real key, and refunds all 503/are-untestable-for-real until `MIDTRANS_SERVER_KEY`/`MIDTRANS_CLIENT_KEY` are provisioned (Task 0.6). The architecture is real and complete (including the exact webhook signature algorithm, verified against a matching test-only key in `payments-webhook.e2e-spec.ts`); only credentials are missing.
- Admin payout-processing UI and admin dispute-resolution UI: both explicitly deferred to Sprint 7 (Tasks 7.4 and 7.5) per this sprint's own task notes - the `/internal` API endpoints exist and are tested (including non-admin 403s), but no admin frontend was built.
- Availability-balance's "COMPLETED booking" rule is implemented correctly but not reachable through the normal booking lifecycle until Sprint 6 (`task-1-session-lifecycle.md`) lands - covered today only via e2e tests that set `booking.status = "COMPLETED"` directly, since no code path can drive a booking there yet.
- No Snap `finish`/`unfinish`/`error` redirect callback URLs are configured on the transaction - the checkout redirect handoff is real (Task 5.2's e2e-tested `redirectUrl`), but the UI intentionally never trusts query params on return, only re-fetching the booking from our own backend (the same principle the task's technical note applies to the webhook). Configuring Snap's own redirect-back URLs is a cosmetic follow-up, not a correctness gap.
