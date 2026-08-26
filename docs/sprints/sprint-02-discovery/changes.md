# Sprint 2 — Changes Log

Status: **Complete**. All 6 tasks built and verified against the real local Postgres/Redis with real seeded data (6 tutors across 5 cities, mixed verification statuses). Tasks 2.2, 2.3, 2.4, and 2.5 were built together as one endpoint from the start, per Task 2.2's own guidance ("design its query parameters with filters in mind... rather than bolting them on after") — the task-by-task breakdown below reflects the plan's structure, not separate implementation passes.

## Task 2.1 — Subjects & Grade Levels Master Data

- Finalized lists: 16 subjects (added Sejarah, Geografi, Ekonomi, Sosiologi, PPKn, Bahasa Mandarin, and 4 UTBK/SNBT tracks to Sprint 0/1's minimal seed), 4 grade-level bands (`SD 1-6`, `SMP 7-9`, `SMA 10-12`, `UTBK/SNBT`) matching the task doc's literal wording — replacing Sprint 0's split `SD 1-3`/`SD 4-6`.
- `RedisService`: a defensive cache wrapper (degrades to "always miss" on any Redis error, never takes the API down) - `GET /subjects`/`GET /grade-levels` cache for 1 hour.
- **Real bug found while writing the seed script**: every `upsert` in `prisma/seed.ts` used an empty `update: {}` block. Re-running the seed against a database that already had these rows (from earlier Sprint 0/1 test runs) silently left them stale — the newly-added `name` field (see Task 2.2 below) never actually got applied to existing users. Fixed by making every `update` clause mirror `create`, so the seed script is genuinely idempotent regardless of prior DB state. This had been silently wrong since Sprint 0 and only surfaced once a test asserted on seeded data that had actually been re-applied.

## Task 2.2 — Tutor Listing API

- **Schema bug found and fixed, blocking this task outright**: neither `User` nor `TutorProfile` had a `name` field. PRD §6.1.B requires a name on every tutor card, and nothing in Sprint 0/1 had ever needed one. Added `User.name` (migration `20260811154828_add_user_name`), plus `PATCH /users/me` to set it, and retrofitted both Sprint 1 onboarding forms (`StudentProfileForm`, `TutorProfileWizard`) to collect it — a real gap in Sprint 1, only caught here.
- `GET /tutors`: offset-paginated (documented choice — simpler to reason about than cursor pagination at MVP scale), returns only `verificationStatus: VERIFIED` tutors, response shape (`TutorListItem`/`PaginatedTutorList`) defined once in `packages/shared` and consumed identically by the API and `apps/web`.
- Added a `hourlyRate` index (`20260811155825_tutor_rate_index`) alongside Sprint 0's existing `city`/`verificationStatus` indexes.
- Default (unfiltered, page-1) query is cached for 60s — shorter TTL than master data since it reflects tutor verification/rate changes, not near-static data.
- `rating`/`reviewCount` are hardcoded `null`/`0` for every tutor - intentional, not a shortcut: no `Review` data can exist before Sprint 6 builds bookings and reviews. [Sprint 6, Task 6.5](../sprint-06-sessions-reviews/task-5-rating-aggregation-display.md) is where this gets wired to real aggregation, exactly as that task doc already specified before this sprint started.

## Task 2.3 — Search & Filters

- Extended the same `GET /tutors` endpoint (not a separate one) with `subjectId`, `gradeLevelId`, `city`, `mode`, `priceMin`/`priceMax`, `q` (keyword, matches tutor name or bio via Postgres `ILIKE`), `sort` (`price`/`rating`/`nearest`), pagination params — all via one `SearchTutorsDto` with `class-validator`.
- `priceMin > priceMax` returns a clean 400 rather than silently-wrong results.
- Availability filtering (cross-referencing `AvailabilitySlot`) is **not implemented** — deliberately deferred, since nothing populates `AvailabilitySlot` until [Sprint 3, Task 3.1](../sprint-03-booking/task-1-tutor-availability-management.md); a filter against permanently-empty data would only ever return zero results.
- 14 e2e tests, all against the real seeded dataset (not mocked `where`-clause assertions) — genuinely verifying city/subject/mode/price filtering, keyword search, and price sort against real query results.

## Task 2.5 — Location & Maps Integration

- Google Maps isn't provisioned (see Sprint 0's third-party checklist). Built `packages/shared/src/cities.ts` instead: a static lat/lng lookup for the PRD's named launch cities (Jabodetabek, Bandung, Surabaya, Medan, Yogyakarta) plus a Haversine `distanceKm()` function. Documented reasoning: since the platform only launches in a known, finite city list, this is arguably more appropriate for MVP than live geocoding — zero external dependency, zero cost, and every supported city is guaranteed to resolve.
- `sort=nearest&near=<city>` computes real distances against this table; candidates are fetched and sorted in application code (not SQL) since distance can't be computed against a static in-memory table in a database query — documented as fine at MVP tutor volumes, worth revisiting only if the candidate set grows large.
- Real math, not just plumbing: 7 unit tests verify actual geographic correctness (Jakarta-Bandung computes to 100-160km, nearby cities are closer than far ones, symmetry holds), plus e2e coverage confirming `distanceKm: 0` for a tutor in the same city as the search origin and correct ascending sort order.
- City input on the frontend is a plain dropdown of `SUPPORTED_CITIES` (imported from `packages/shared`, so the frontend and backend can never drift) rather than Google Places Autocomplete.

## Task 2.4 — Tutor Detail Profile Page

- `GET /tutors/:id` returns a `TutorDetail` (extends `TutorListItem` with `education` and real `availabilitySlots` — empty for every tutor today, populated once Sprint 3 builds availability management, but the field itself is real and tested, not a stub).
- Same 404 for a nonexistent id and an unverified tutor's id — doesn't leak which pending/rejected tutor ids exist.
- Web: `TutorDetailView` renders photo/bio/education/rate/subjects/grade levels, an availability section (empty-state copy until Sprint 3), a reviews section ("Belum ada ulasan" per the task's own guidance), and a "Pesan Sekarang" (Book Now) button.
- **Book Now routes to a real stub page** (`/bookings/new?tutorId=...`), not a dead link or `alert()` — Sprint 3 replaces the page content only, per the task's explicit instruction not to make that sprint retrofit the entry point.
- **Build bug found and fixed**: the stub booking page reads `tutorId` via `useSearchParams()`, which Next.js requires to be wrapped in a `Suspense` boundary for static export — without it, `next build` fails outright on that page. Caught by the actual build, not by inspection.

## Task 2.6 — Discovery UI (Web)

- `TutorSearch`: search bar, filter row (subject/grade-level/city/mode/sort dropdowns, all backed by real API data), tutor card list using `packages/ui`'s `TutorCard` (built in Sprint 0, now used with real data for the first time), pagination, loading/error/empty states.
- Homepage (`/`) no longer shows the Sprint 0 static `TutorCard` demo data — replaced with a real "Cari Tutor" CTA into `/tutors` for logged-out visitors and students, alongside the existing tutor-verification-status view for tutors.
- 9 new component tests (`TutorSearch`, `TutorDetailView`) — focused on frontend-specific concerns (filter changes trigger a new fetch, empty/error states render, card click navigates, Book Now routes to the stub) since the underlying query logic is already thoroughly covered by the 14 backend e2e tests; no need to re-prove Postgres filtering correctness at the component-test layer.

---

## Final verification (whole workspace, this sprint)

- `pnpm build` — clean across all packages, including full static prerender.
- `pnpm lint` / `pnpm typecheck` — clean.
- API: 62 unit tests + 46 e2e tests (up from 53/30 at the end of Sprint 1), all passing against the real DB.
- Web: 43 component tests (up from 34), all passing.
- Live smoke test: booted `pnpm dev`, confirmed `GET /api/tutors`, `GET /api/tutors?sort=nearest&near=Jakarta Selatan`, and `/tutors` all return correct real data end-to-end.

## What's genuinely ready for Sprint 3

Booking (Sprint 3) can build directly on: a working tutor detail page with a real "Book Now" entry point already wired to `/bookings/new?tutorId=...`, verified tutor data to book against, and the `AvailabilitySlot` model already wired into the discovery API's response shape (currently always empty) so Task 3.1's availability management immediately becomes visible on tutor profiles with no discovery-side changes needed.
