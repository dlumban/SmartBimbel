# Task 0.2 — CI/CD Pipeline

**Sprint:** 0 — Foundation & Tech Setup
**Estimate:** 2 days

## Goal

Every PR is automatically linted, tested, and built; every merge to `main` deploys to staging without manual steps.

## Scope

- GitHub Actions workflow: `lint-test-build.yml` triggered on PR — runs per-app lint, unit tests, and build (web, admin, api via pnpm/turbo cache; mobile via `flutter analyze` + `flutter test`).
- GitHub Actions workflow: `deploy-staging.yml` triggered on merge to `main` — deploys `api` to Railway/Render staging, `web`/`admin` to Vercel preview→staging aliases.
- GitHub Actions workflow: `deploy-production.yml` triggered on tagged release — deploys to production with a manual approval gate.
- Flutter CI: build Android APK artifact on PR for manual QA install; iOS build gated behind a separate workflow (requires Apple signing, set up when needed).
- Status checks required before merge (branch protection on `main`).

## Acceptance Criteria

- [ ] Opening a PR triggers lint/test/build and blocks merge on failure.
- [ ] Merging to `main` deploys `api`, `web`, `admin` to staging within 10 minutes, verifiable via a staging URL.
- [ ] A tagged release deploys to production only after manual approval in GitHub Actions.
- [ ] Flutter PR builds produce a downloadable APK artifact.
- [ ] Secrets (DB URLs, API keys) are stored in GitHub Actions secrets / Railway-Vercel env config, never in workflow files.

## Technical Notes

- Use Turborepo remote caching (or GitHub Actions cache) to keep CI fast as the monorepo grows.
- iOS signing/TestFlight pipeline can be deferred to closer to Sprint 8 (soft launch) if it blocks early velocity — Android is the priority platform per PRD §1.

## Dependencies

- [Task 0.1 — Repository & Monorepo Structure Setup](task-1-repo-monorepo-setup.md)
