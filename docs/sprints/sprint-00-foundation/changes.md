# Sprint 0 — Changes Log

Status: **Complete**, with third-party account creation and cloud deploys explicitly deferred to the project owner (see rationale in each task section below). Every acceptance criterion that could be verified locally was actually run against real tooling (Postgres, Docker, pnpm, Next.js, NestJS) — not just written and assumed to work; several real bugs were caught and fixed in the process (see "Bugs found and fixed").

## Environment note

This session's environment ships with **no Node.js, pnpm, Docker, Postgres, Redis, or package manager on native Windows** — only git. Discovered that the project directory (`Z:\...`) is actually a mapped view of a WSL2 Ubuntu distro (`\\wsl.localhost\Ubuntu`) that already has Docker, Node 20, pnpm, git, and psql installed. All commands for this build run through WSL (`wsl.exe -e bash -lc "cd /home/developer/projects/SmartBimbel && ..."`), not native PowerShell/Git Bash. Recorded in memory (`env_wsl_environment.md`) so future sessions don't rediscover this.

---

## Task 0.1 — Repository & Monorepo Structure Setup

**Status:** Done and verified.

- Initialized git repo (`main` branch).
- pnpm workspace: `apps/web`, `apps/admin`, `services/api`, `packages/shared`, `packages/design-tokens`, `packages/ui` (the latter two added during Task 0.5, see below).
- `apps/mobile` scaffolded as a placeholder only — Flutter is deferred (see "Deviations from the original task specs").
- Turborepo (`turbo.json`) orchestrates `build`/`dev`/`lint`/`test`/`typecheck` across all packages, with `packages/shared` and `packages/design-tokens` built before anything else via the root `dev` script.
- `CONTRIBUTING.md`, root `README.md`, `.gitignore`, `.editorconfig`, `.nvmrc`, `.prettierrc.json` added.
- Every app has a `.env.example`; no real secrets committed.

**Verified:** `pnpm install` succeeds (963 packages); `pnpm dev` boots `api` (port 4000), `web` (port 3000), `admin` (port 3001) concurrently with working hot reload (Next Fast Refresh + `nest start --watch` + `tsc --watch` for the packages); all three respond over HTTP (`curl` confirmed 200s and the health JSON payload).

**Bug found and fixed:** the first backgrounded `pnpm dev` process died when its parent shell exited (no `setsid`/`disown`) — looked like a successful boot in the log but the servers weren't actually listening. Fixed by properly daemonizing the process; re-verified with live `curl` requests against all three ports afterward instead of trusting the log alone.

## Task 0.2 — CI/CD Pipeline

**Status:** Written and syntax-validated; **not live-verified** — no GitHub remote exists yet, so none of these workflows have actually run.

- `.github/workflows/lint-test-build.yml` — PR/push trigger, runs lint/typecheck/test/build for web/admin/api, plus a Flutter job that no-ops cleanly (`pubspec.yaml` doesn't exist yet) instead of failing.
- `.github/workflows/deploy-staging.yml` — triggered on green `main`, deploys API to Railway and web/admin to Vercel via matrix.
- `.github/workflows/deploy-production.yml` — triggered on version tags, gated behind a `production` GitHub Environment (manual approval).
- All three validated with `python3 -c "import yaml; yaml.safe_load(...)"` — syntactically correct YAML, logically consistent triggers/gates.

**Deferred (needs your action):** push this repo to a GitHub remote, add the secrets these workflows reference (`RAILWAY_*_TOKEN`, `VERCEL_*`), and configure the `production` Environment with required reviewers. Exact steps in [docs/infrastructure.md](../../infrastructure.md).

## Task 0.3 — Cloud Environments

**Status:** Local dev complete and verified; staging/production explicitly deferred.

- `docker-compose.yml` at repo root: Postgres 16 (host port **5433**) + Redis 7 (host port **6380**) — non-default ports chosen deliberately after discovering the WSL instance already had an unrelated Redis container (`umkm-redis`) bound to 6379 and something (WSL relay) on 5432.
- `/api/health` endpoint exists, now also checks live DB connectivity (added while building Task 0.4, see below).
- `docs/infrastructure.md` documents environment status, env var locations, and the exact manual steps to provision staging/production.

**Verified:** `docker compose up -d` → both containers report `healthy`; `psql` connects and runs a query; `docker exec smartbimbel-redis redis-cli ping` returns `PONG`.

**Deferred (needs your action):** Railway/Render + Vercel account and project creation, domain registration — all require billing/ownership that has to be yours. See [docs/infrastructure.md](../../infrastructure.md).

## Task 0.4 — Core Database Schema & Data Models

**Status:** Done and verified against a real database.

- `services/api/prisma/schema.prisma`: every entity from PRD §10 — `User`, `TutorProfile`, `StudentProfile`, `Subject`, `GradeLevel`, `AvailabilitySlot`, `Booking`, `Conversation`, `Message`, `Transaction`, `Payout`, `Review` — plus enums (`UserRole`, `VerificationStatus`, `TeachingMode`, `BookingStatus`, `TransactionStatus`, `PayoutStatus`).
- Deliberately **excluded** payout-batching and dispute/refund tables per the task's own scope note — those belong to Sprint 5/7 when those features are actually built, not guessed now.
- `services/api/prisma/seed.ts` seeds 8 subjects, 5 grade levels, one seed student, one seed (verified) tutor.
- `docs/data-model.md` — Mermaid ERD plus notes on scope decisions.
- `PrismaModule`/`PrismaService` wired into the NestJS app (`@Global()`, connects on module init) — genuinely foundational plumbing every future sprint needs, not speculative.

**Verified:** `prisma migrate dev --name init` ran clean against the empty dev database, applied via `prisma migrate dev`; confirmed via `psql \dt` that all 12 model tables + 3 implicit many-to-many join tables exist; seed script ran and `psql` confirms the seeded rows; `/api/health` now reports `"database":"ok"` (and `"unreachable"` under a mocked failure, covered by a unit test) proving the API can actually talk to Postgres end-to-end.

## Task 0.5 — Design System & UI Kit

**Status:** Code portion done and verified; Figma file and Flutter theme deferred.

- `packages/design-tokens`: color scales (primary/accent/success/warning/danger/neutral), type scale, spacing scale, shadows — a placeholder brand palette derived from Tailwind's own indigo/orange/slate scales (pre-vetted for contrast).
- `packages/ui`: `Button`, `Badge`, `Card`, `Input`, `Modal`, `RatingStars`, `EmptyState`, `ErrorState`, `LoadingSpinner`, `TutorCard` — consumed directly from source by both Next.js apps via `transpilePackages`.
- Both `apps/web` and `apps/admin` homepages now render real content built only from `packages/ui` (proves cross-app consistency, scoped to web+admin since mobile is deferred).
- `docs/design-system.md` documents the above plus a full WCAG AA contrast audit.

**Bug found and fixed (accessibility):** `TutorCard`'s avatar-placeholder text was `text-neutral-400` on `bg-neutral-100` — contrast ratio 2.34, fails WCAG AA even for large text. Computed contrast ratios programmatically (relative-luminance formula) for every text/background pairing actually used across the component set, not just the obvious ones; this was the one real failure, fixed to `text-neutral-600` (ratio 6.92).

**Bug found and fixed (build):** Next.js App Router requires `"use client"` on any component using hooks or DOM event handlers — `Button`, `Input`, `Modal`, `TutorCard`, and `states.tsx` (`ErrorState`'s retry button) all needed it; caught by an actual `next build` failure, not by inspection.

**Deferred (needs your action or a designer):** the actual Figma file — nothing to build in code here. Flutter `ThemeData` — deferred with mobile.

## Task 0.6 — Third-Party Service Accounts

**Status:** Fully deferred by necessity — documented, not created.

Every account listed in the task (Firebase, Midtrans, Stream Chat, WhatsApp BSP, Sentry, Google Maps, Cloudinary, Mixpanel/Amplitude) requires business ownership, billing details, or identity verification that can't be done on your behalf. `docs/third-party-setup.md` is the full checklist: what each service is for, the exact setup steps, which env var each one maps to (all already scaffolded in the relevant `.env.example` files), and which sprint each one blocks.

**What isn't blocked in the meantime:** the API boots and its `/api/health` endpoint works with zero third-party credentials configured — verified above. Feature sprints that need one of these services will mock/console-log in local dev where practical, documented in that sprint's own `changes.md`.

---

## Deviations from the original task specs

- **Mobile (Flutter) is deferred**, per an explicit scoping decision made before this build started (no Flutter SDK/Android toolchain in this environment, and standing it up was scoped out in favor of backend+web+admin first). Every Flutter-specific acceptance criterion across all 6 tasks is unimplemented; `apps/mobile/README.md` documents exactly what to do when mobile work resumes.
- **Cloud accounts (Railway/Render, Vercel, Firebase, Midtrans, Stream Chat, WhatsApp BSP, Sentry, Google Maps, Cloudinary, GitHub remote)** are all deferred to the project owner for the reasons above. Every place the codebase would use one degrades gracefully (local Postgres/Redis instead of managed, `/api/health` needs no external service, `.env.example` documents every variable).

## What's genuinely ready for Sprint 1

- `pnpm install && docker compose up -d && pnpm --filter @smartbimbel/api prisma:migrate && pnpm dev` takes a fresh clone to three running apps against a real seeded database, no manual steps beyond that.
- Auth guards ([Task 1.7](../sprint-01-auth-onboarding/task-7-session-auth-guards.md)) will need Firebase credentials to fully exercise — that's the one place Sprint 1 is genuinely blocked until Firebase is provisioned (see Task 0.6 above). Everything else in Sprint 1 (role selection, profile forms, DB writes) doesn't depend on it.
