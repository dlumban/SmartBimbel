# Task 8.3 — Security Review & Hardening

Dedicated audit pass across everything built since Sprint 0, per the task's own technical note ("treat it as a dedicated audit pass covering everything built since Sprint 0" rather than only reviewing diffs sprint-by-sprint). Findings are organized against the task's own AC checklist.

## 1. Auth guard coverage

Every controller in `services/api/src` was enumerated and its guard/role decorators checked. Routes with **no** `FirebaseAuthGuard` fall into exactly two categories, both intentional:

- **Genuinely public** (discovery/master-data, meant to be reachable by anyone): `GET /subjects`, `GET /grade-levels`, `GET /tutors` (search), `GET /tutors/:id` (public profile), `GET /tutors/:id/reviews`, `GET /health`.
- **External-service webhooks** (can't carry a Firebase bearer token; protected by their own signature verification instead of `FirebaseAuthGuard`): `POST /chat/webhook` (Stream HMAC signature, Task 4.1), `POST /webhooks/midtrans` (SHA512 signature, Task 5.1).
- `POST /auth/session` is the login exchange itself - necessarily unauthenticated, rate-limited separately (see §6).

Every other controller carries `@UseGuards(FirebaseAuthGuard, ...)`. No missing-guard gaps found.

## 2. IDOR review

Spot-checked every endpoint that accepts an object ID and doesn't already scope to "admin, sees everything by design":

- **Bookings** (`:id`, `:id/history`, `:id/accept`, etc.): `BookingsService.actorRoleFor()` throws `ForbiddenException` for any non-participant before any mutation or detail read - checked at the top of every method that takes a booking ID.
- **Availability slots** (`:slotId` update/delete): `requireOwnedSlot()` checks `slot.tutorId === tutorProfile.id` and returns `404` (not `403`) on mismatch - deliberately avoids confirming to an attacker that a slot ID exists at all when it isn't theirs.
- **Chat** (`:bookingId/...`): `ChatService` checks participant membership *before* ever calling Stream (Task 4.1's own documented design - the 403 fires even when Stream itself is unconfigured).
- **Disputes** (`:bookingId/disputes`): `DisputesService.raise()`/`listForBooking()` check `booking.student.userId === user.id || booking.tutor.userId === user.id`.
- **Reviews** (`:bookingId/review`): `ReviewsService.submit()`/`getForBooking()` check the same way; `submit()` additionally requires the caller be specifically the *student* (one-directional reviews).
- **Payments**: `initiatePayment()` checks `booking.student.userId === user.id`; `GET /transactions` scopes its query by the caller's own `StudentProfile`/`TutorProfile` row looked up from `user.id` (never from a client-supplied ID).
- **Payouts/earnings/tutor self-service routes** (`tutors/me/...`, `payouts`, `students/me`): none of these take an object ID at all - they're resolved from the authenticated `user.id` every time, structurally eliminating IDOR risk rather than needing a runtime check.
- **Admin `/internal/*` routes**: intentionally *not* ownership-scoped (an admin needs to look up any user/booking/transaction) - gated instead by `RolesGuard`/`AdminRoleGuard`, verified in Sprint 7's e2e suite (`admin-panel.e2e-spec.ts`'s RBAC tests).

No IDOR issues found; no fixes needed.

## 3. File upload handling

`POST /tutors/me/documents/:type` (KTP/diploma, Task 1.5): `ALLOWED_DOCUMENT_MIME_TYPES` (`image/jpeg`, `image/png`, `application/pdf`) and `MAX_DOCUMENT_SIZE_BYTES` (5 MB) were already enforced via `FileInterceptor`'s `limits` option and an explicit MIME check. Documents are stored via `StorageService` under a path keyed by internal user ID (never client-supplied) and are only ever readable through the authenticated download routes (`GET /tutors/me/documents/:type` self-service, `GET /internal/tutors/:id/documents/:type` admin-only, added this sprint's predecessor) - never a public URL.

**Fixed this pass**: `multer` (the underlying upload-handling library) was pinned at `2.0.2` transitively via `@nestjs/platform-express`, vulnerable to three HIGH-severity DoS advisories (uncontrolled recursion, resource exhaustion, deeply-nested-field-name parsing). Forced to `>=2.2.0` via a root `pnpm.overrides` entry - see §5.

## 4. Payment security (PCI scope)

Confirmed by code review, not assumed: `Transaction` (schema) stores only `amount`, `commission`, `gatewayRef`, `refundedAmount`, `status`, `paidAt` - no card number, CVV, or expiry field exists anywhere in the schema or codebase (`grep` for card-related field names across `services/api/src` returned zero matches). `MidtransService.createSnapTransaction` only ever sends `order_id`/`gross_amount` to Midtrans and receives back a `token`/`redirect_url` for their *hosted* Snap checkout page (Task 5.1's architectural decision) - the student's browser is redirected to Midtrans's own domain to enter payment details, which never transit our servers. PCI scope stays minimal by construction.

## 5. Dependency vulnerability scan (`pnpm audit --prod`)

Before this pass: **64 findings** (1 critical, 21 high, 34 moderate, 8 low). After:

| Fix | What | Result |
|---|---|---|
| `next` bumped `14.2.15` → `14.2.35` (the latest 14.x release - apps/web, apps/admin) | Patches **CVE-2025-29927** (critical - authorization bypass in Next.js Middleware, letting a crafted request skip middleware-enforced auth checks entirely) plus every other high-severity DoS/SSRF advisory that has a 14.x-line fix available | Critical → 0; high (from `next` specifically) → 0 |
| `pnpm.overrides`: `multer >=2.2.0` | 3 high-severity multer DoS advisories (see §3) | Fixed |
| `pnpm.overrides`: `lodash >=4.18.0` | High-severity code-injection via `_.template` (transitive via `@nestjs/config`) + a moderate prototype-pollution advisory | Fixed |
| `pnpm.overrides`: `postcss >=8.5.23` | High-severity arbitrary-file-read/path-traversal via `sourceMappingURL` (transitive via `next`) | Fixed |

**Process note, corrected mid-review**: while chasing a build failure, an initial attempt also forced `undici` (transitive via `firebase>@firebase/auth`) to `>=6.28.0` via `pnpm.overrides`, which broke `next build`'s static-page prerendering (`TypeError: n.util.markAsUncloneable is not a function`) - the override reached into Next.js's *own* internal, separately-versioned `undici` dependency, not just Firebase's, and the newer `undici` internals aren't compatible with this Node.js version's (`v20.20.2`) `node:util` surface in Next 14's bundled server runtime. The first fix attempt changed two variables at once (dropped `next` to `14.2.25` *and* removed the override) and only re-verified the build, not the dependency-audit outcome - which silently reintroduced two high-severity, 14.x-fixable `next` DoS advisories that installing `@sentry/nextjs` later re-surfaced via a pnpm deprecation warning. Caught and corrected by isolating the two variables properly: `next` restored to `14.2.35` (confirmed to build clean **without** the undici override), undici override left out entirely. This is exactly the kind of two-variables-at-once mistake the project's "run everything, not just what you touched" verification habit exists to catch - flagged here rather than glossed over.

**Residual findings after this pass** (down to 44 total: 0 critical, 12 high, 24 moderate, 8 low):

- **8 high-severity `next` advisories require Next.js 15** - no 14.2.x patch exists for them (confirmed: `14.2.35` is the newest 14.x release; everything past it is a `14.3.0` canary/pre-release). A 14→15 major upgrade carries real regression risk across two full Next.js apps with React 18→19 and App Router behavioral changes, and deserves its own dedicated migration effort with full regression testing - **explicitly out of scope for this hardening pass**, tracked as follow-up work.
- **4 high-severity `undici` advisories** remain in `firebase`'s transitive dependency chain (client-side, `apps/web`/`apps/admin` only) - per the override-breaks-the-build finding above. Real-world exploitability is low in this specific environment: this code path only activates once real Firebase credentials are provisioned (still not the case anywhere in this project, per `docs/third-party-setup.md`), and the advisories are WebSocket-DoS-focused, not auth-bypass or data-exposure. Worth revisiting once Firebase ships a `firebase` release that bumps its own `undici` floor (the clean, non-override fix), or as part of the Next 15 migration above (which may itself update the vendored copy).
- No moderate/low finding reviewed suggested a comparable severity/urgency to the two items above; none block launch on their own.

## 6. Rate limiting review

Global default (`ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])`, applied via `APP_GUARD`) already covers every endpoint in the app, not just auth - confirmed by reading `app.module.ts`. `POST /auth/session` additionally carries a stricter `@Throttle({ default: { limit: 10, ttl: 60_000 } })` (Task 1.1), appropriate for a login/credential-exchange endpoint. Webhook endpoints (`/chat/webhook`, `/webhooks/midtrans`) rely on the same global limit plus their own signature verification (a request that fails signature verification never touches business logic) - reasonable for MVP-scale traffic. No gaps found; no changes made.

## 7. Personal data protection review (against UU PDP principles)

**What's collected**: name, phone (unique), email (unique), KTP/diploma document images (tutors only, Task 1.5), city/location (free-text, no precise geocoordinates stored), bank account details (tutors, for payouts - Task 5.5), booking/session history, chat messages, reviews.

**How it's stored**: relational rows in the shared Postgres database (`services/api/prisma/schema.prisma`); KTP/diploma images on local disk via `StorageService` (or Cloudinary once `STORAGE_PROVIDER=cloudinary` is configured for production, per `docs/third-party-setup.md` - not yet provisioned in this environment). No personal data is written to any third-party analytics/logging tool (see Task 8.5's own scope for the dedicated PII-in-analytics check, deferred alongside that task since no analytics account is provisioned yet to check against).

**Who can access it**: the user themselves (self-service `me` routes); the other party to a specific booking (only the fields relevant to coordinating that session - name, not phone/email, unless voluntarily shared in chat); platform admins (`/internal/*` routes, RBAC-gated per Sprint 7, every admin read/write of user data is now audit-logged per Task 7.1). KTP/diploma documents are additionally restricted to the tutor themselves and admins reviewing verification (never the student, never a public URL).

**Retention**: no automated deletion/retention policy exists yet - `User.status = SUSPENDED` (Sprint 7's suspend action) disables access but does not erase data, and there's no account-deletion or data-export endpoint (a UU PDP "right to erasure/portability" gap). **Flagged, not closed this pass**: implementing a genuine account-deletion flow (including how it interacts with financial records that may need to be retained for accounting/legal reasons) is a product/legal decision Task 8.6 already identifies as needing stakeholder sign-off, not a pure engineering task - noted here so it isn't lost, but not attempted without that sign-off.

## 8. Secrets audit

- `grep`'d the full source tree for hardcoded API-key-shaped strings (Firebase private keys, live Stripe/Midtrans-style secret prefixes, bearer-token-shaped literals) - zero matches outside test fixtures (which use obviously-fake values like `"good-token"`).
- Every `.env.example` across `services/api`, `apps/web`, `apps/admin` contains only empty placeholder values for every credential - confirmed by reading all three files directly.
- `services/api/.env` (the real local dev file) exists but contains only local-only values (`DATABASE_URL`/`REDIS_URL` pointing at the docker-compose Postgres/Redis with the throwaway local password already visible in `docker-compose.yml`) and empty third-party credential fields - no real secret ever provisioned in this environment to begin with.
- Root `.gitignore` correctly excludes `.env`/`.env.local`/`.env.*.local` while allowlisting `.env.example` - confirmed by reading it directly. (This repository has no `.git` initialized yet in this environment, so there is no git history to separately audit; the exclusion rule is in place and correct for whenever it is initialized.)
- Every `NEXT_PUBLIC_*` client-exposed variable (Firebase config, Stream API key, Google Maps key, Sentry DSN) is a key that's *designed* to be public per each vendor's own security model (e.g. Firebase's API key is not a secret - access control is enforced by Firebase Security Rules / backend token verification, not by hiding the key) - no server-only secret is exposed client-side.

No secrets found; no fixes needed.

---

## Summary against the task's AC

- [x] No IDOR vulnerabilities found in a sampled review of booking, profile, transaction, and document endpoints.
- [x] Confirmed no raw payment card data ever transits or is stored on SmartBimbel infrastructure.
- [x] Personal data handling documented against UU PDP principles; one gap flagged (account deletion/retention policy) and explicitly not closed pending the business/legal sign-off Task 8.6 already calls for.
- [x] No secrets found in the repository or client-side bundles.
- [~] No **critical** dependency vulnerabilities remain (fixed: was 1, now 0). 12 **high**-severity findings remain, both root-caused and documented above (Next.js 15 requirement; a build-breaking `pnpm.overrides` incompatibility for `undici`) rather than silently left open - not fully closed, but not blindly ignored either.
