# Sprint 1 — Changes Log

Status: **Complete**. All 7 tasks built and verified against a real local Postgres, with the Firebase Admin/client SDK boundary mocked in tests (Firebase itself isn't provisioned — see [Sprint 0's third-party checklist](../sprint-00-foundation/changes.md)). 83 automated tests added this sprint (53 API unit + 30 API e2e, all passing against the real DB; 33 web component tests, counted separately below) — every one actually run, not just written.

## Sequencing change: Task 1.7 moved ahead of Tasks 1.3–1.6

The sprint plan listed Task 1.7 (Session Management & Auth Guards) last. Starting Task 1.3 (role selection) surfaced that it's impossible to build without first answering "who is the currently authenticated user making this request" — exactly Task 1.7's job. Every one of 1.3, 1.4, 1.5, and 1.6 needs a request-scoped authenticated user, so Task 1.7 was pulled forward and built immediately after 1.1/1.2. Actual build order: **1.1 → 1.2 → 1.7 → 1.3 → 1.4 → 1.5 → 1.6**. Noting this so the sprint doc's own dependency graph gets corrected for future planning — Task 1.7 should be listed as an early/foundational task, not a closing one.

## Methodology: mocking the Firebase boundary

Firebase isn't provisioned in this environment (deferred, see Sprint 0). Rather than skip testing auth-dependent code, every test mocks only `FirebaseAdminService.verifyIdToken` (backend) or the `firebase/auth` SDK functions (frontend) — the actual external call — while exercising real business logic against the real local Postgres (backend) or real component rendering (frontend). This means: user upsert logic, role-transition rules, profile validation, file storage, and the full admin-verification state machine are all genuinely tested end-to-end; only "does Firebase itself correctly issue a token" is unverified, which is Firebase's own tested infrastructure, not this app's code.

## Task 1.1 — Phone OTP Authentication (Backend)

- `FirebaseAdminService`: lazily initializes the Admin SDK from env vars; throws a clear 503 (not a boot crash) when unconfigured, so the API stays usable for everything else.
- `POST /auth/session`: verifies a Firebase ID token, upserts a `User` keyed by `firebaseUid`, normalizes phone numbers to E.164 via `libphonenumber-js` (defaulting to ID country code).
- Rate limiting: `@nestjs/throttler`, global default 100 req/min, tightened to 10 req/min on this specific route.

**Schema bug found and fixed:** `User.role` was originally required (non-null) in the Sprint 0 schema. Building this task surfaced that a Firebase-authenticated user has no role until Task 1.3's role selection — the schema couldn't represent that state. Migrated `role` to nullable (`20260811144848_make_role_optional`).

**Verified:** 6 unit tests (new user, existing user, email sync, invalid token, 503-when-unconfigured) + 5 e2e tests against real Postgres, including one that actually trips the rate limiter and asserts a real 429.

## Task 1.2 — Email & Google OAuth Login

- `apps/web/src/lib/firebase.ts`: client SDK init, `apps/web/src/components/LoginForm.tsx`: Google button + email/password form + forgot-password, all calling the same `POST /auth/session`.

**Build bug found and fixed:** `getAuth()` validates the API key format eagerly, not just on network calls. Since `apps/web/app/layout.tsx` wraps every page in `AuthProvider`, this crashed Next's static prerendering for the *entire app* (including the homepage) the moment Firebase env vars are empty — which they are here. Fixed by wrapping Firebase init in try/catch, exporting a nullable `firebaseAuth`, and having every consumer (the auth hook, the login form) handle the null case explicitly rather than assuming Firebase is always configured.

**Verified:** 6 component tests (login, register, Google, error states, password reset) + full production build (including static prerender of every page) succeeding.

## Task 1.7 — Session Management & Auth Guards (built early, see above)

- `FirebaseAuthGuard`: verifies the Bearer token, loads the matching `User`, rejects suspended accounts, attaches `request.user`.
- `RolesGuard` + `@Roles()` + `@CurrentUser()`: role-based route protection built on top.
- `GET /users/me`: first protected route, exercising the whole guard chain.
- Web: `apiFetch()` wrapper attaches the current ID token to every call and redirects to `/login` on 401; Firebase's SDK handles token refresh internally (`getIdToken()` returns a valid token as long as the session is live — no manual refresh logic needed).

**Verified:** 11 guard unit tests + 5 e2e tests (401 with no token, 401 with a bad token, 401 for a token with no matching user, 200 with the right user) + 3 frontend tests for `apiFetch` (Bearer header attached, Content-Type handling, 401 redirect — the last one required a real fix, see Task 1.5 notes on `FormData`).

## Task 1.3 — Role Selection & Registration Flow

- `PATCH /users/me/role`: sets role exactly once (409 on a second attempt); self-service is limited to `STUDENT`/`TUTOR` — `ADMIN` is deliberately not selectable here (see Task 1.6).
- `hasProfile` computed field added to every user-summary response (`GET /users/me`, `POST /auth/session`) — the single source of truth the frontend uses to decide where to route a logged-in user.
- Web: `getOnboardingRedirect()` (a pure, unit-tested function) centralizes the routing rule — no role → `/onboarding/role`; role but no profile → `/onboarding/profile`; both → stay put — used consistently by the homepage and the onboarding pages themselves.

**Verified:** 4 service unit tests + 3 e2e tests (403 for wrong context, set-once enforcement, invalid role value) + 11 frontend tests (`RoleSelector`, `getOnboardingRedirect`).

## Task 1.4 — Student/Parent Profile Setup

- Pulled forward a minimal `GET /subjects` / `GET /grade-levels` (Sprint 2, Task 2.1's nominal scope) since this form can't function without them — deliberately bare (no caching, no filtering); Sprint 2 builds the fuller version on top.
- `POST /students/profile` / `GET /students/me` / `PATCH /students/me`, all validating that referenced `subjectIds`/`gradeLevelId` actually exist before writing (clean 400s instead of raw Prisma FK errors).
- Web: tag-style multi-select subject picker, grade-level dropdown, location/mode fields, all built on `packages/ui`.

**Verified:** 6 service unit tests + 5 e2e tests (role-gated 403, duplicate-profile 409, unknown-reference 400, full create/read/update cycle against real seeded master data) + 4 frontend tests.

## Task 1.5 — Tutor Multi-Step Profile Completion

- Schema addition: `ktpDocumentPath`, `diplomaDocumentPath`, `profileSubmittedAt`, `rejectionReason` on `TutorProfile` (migration `20260811152044_tutor_verification_fields`) — none of these existed in Sprint 0's schema, which only anticipated the fields a discovery listing would need, not the verification workflow.
- `StorageService`: local-disk file storage (gitignored `.devdata/uploads`), gated behind `STORAGE_PROVIDER=local` since Cloudinary isn't provisioned. Documents are never served by a static file middleware — only through an authenticated, ownership-checked route.
- `PUT /tutors/profile` (upsert, called after every wizard step so progress survives closing the app mid-flow), `POST /tutors/me/documents/:type` (multipart upload, MIME/size validated), `POST /tutors/profile/submit` (validates every required field + KTP present before flipping `profileSubmittedAt`).
- Web: 4-step wizard (`TutorProfileWizard`) that **resumes at the correct step** by fetching the existing profile and checking which fields are already filled in — a real implementation of the "closing mid-flow resumes correctly" acceptance criterion, not just a claim.

**Scope cut, documented deliberately:** profile *photo* upload is not implemented. Unlike KTP/diploma (which must stay private), a tutor's photo needs to be publicly viewable once Sprint 2's discovery listing exists — building a private-storage-only upload now would need to be redone once public serving is figured out. `TutorProfile.photoUrl` remains in the schema as an optional field for that future work.

**Design bug found and fixed:** initially, `hasProfile` meant "profile row exists" — but a tutor's row is created on step 1 of 4. That would have kicked a mid-onboarding tutor back to the homepage the instant they finished step 1. Fixed by making `hasProfile` mean "row exists" for students (atomic, one-shot creation) but "`profileSubmittedAt` is set" for tutors (multi-step) — see `toUserSummary()`.

**Verified:** 10 service unit tests + 6 e2e tests including a **real multipart file upload and download round-trip** through supertest's `.attach()`, MIME-type rejection, and the full multi-step PUT sequence + 8 frontend tests including step-resume logic.

## Task 1.6 — Minimal Tutor Verification Workflow

- Since `RolesGuard`/`@Roles()` already existed (pulled forward for Task 1.7), this could use real `@Roles("ADMIN")` protection directly on `/internal/tutors/*` instead of the informal stopgap (env-var-gated check) the task doc originally envisioned as necessary before Sprint 7's full RBAC existed. Net simpler than planned.
- `GET /internal/tutors/pending`, `PATCH /internal/tutors/:id/verification` (requires a `reason` when rejecting). Per the task's own allowance, no admin UI was built — Prisma Studio (or direct API calls) is sufficient to exercise this at MVP scale; Sprint 7 builds the real panel.
- **Resubmission bug found and fixed while writing the e2e test:** a rejected tutor who fixes their profile and resubmits needs to reappear in the pending queue. The queue filters on `verificationStatus: "PENDING"`, but nothing was resetting that field away from `REJECTED` on resubmission — `submitForReview()` now explicitly resets `verificationStatus` to `PENDING` and clears `rejectionReason` on every (re)submission.
- Web: tutor-facing status badge (`TutorVerificationStatus`) on the homepage showing PENDING/VERIFIED/REJECTED with the rejection reason when applicable; the profile wizard itself shows a rejection banner and allows editing/resubmission, or a static "already verified" message if there's nothing left to do.
- **Related routing bug found and fixed:** `hasProfile` stays `true` after a rejection (the profile *was* submitted), so the naive "hasProfile → bounce away from /onboarding/profile" guard would have locked a rejected tutor out of the very page they need to fix their profile on. Fixed: only students bounce on `hasProfile` alone; for tutors, `TutorProfileWizard` itself decides whether there's anything left to do once it has loaded the real verification status.

**Verified:** 4 service unit tests + 6 e2e tests covering the full lifecycle: 403 for non-admins, queue listing, approve, reject-requires-reason, and the resubmission-reappears-in-queue flow — end to end against real data, admin bootstrapped directly via Prisma (matching how a real deployment creates its first admin, since admin is intentionally not self-service).

---

## Final verification (whole workspace, this sprint)

- `pnpm build` — clean across all 5 packages/apps, including full static prerender of every new page.
- `pnpm lint` / `pnpm typecheck` — clean, zero warnings.
- `pnpm test` — 53 API unit tests + 33 web component tests, all passing.
- `pnpm --filter @smartbimbel/api test:e2e` — 30 tests, all passing against the real local Postgres.
- Live smoke test: booted `pnpm dev`, confirmed `/api/health`, `/`, `/login`, and `/api/subjects` all respond correctly with real seeded data.

## What's genuinely ready for Sprint 2

Discovery (Sprint 2) can build directly on: verified tutors exist and are queryable (`verificationStatus`), subjects/grade-levels have a (bare-bones) listing endpoint to extend, and the auth guard infrastructure needs no further changes for a public (unauthenticated) browse experience.
