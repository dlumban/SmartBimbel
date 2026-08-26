# Sprint 0 — Foundation & Tech Setup

**Duration:** 2 weeks
**PRD reference:** §9 (Tech Stack), §10 (Data Models)

## Goal

Stand up the repo, environments, core data model, design system, and third-party accounts so every following sprint can build feature code from day one instead of yak-shaving infrastructure.

## Scope

1. [Repository & Monorepo Structure](task-1-repo-monorepo-setup.md)
2. [CI/CD Pipeline](task-2-cicd-pipeline.md)
3. [Cloud Environments (dev/staging/prod)](task-3-cloud-environments.md)
4. [Core Database Schema & Data Models](task-4-database-schema.md)
5. [Design System & UI Kit](task-5-design-system.md)
6. [Third-Party Service Accounts](task-6-third-party-accounts.md)

## Dependencies

None — this is the starting sprint.

## Exit Criteria

- A developer can clone the repo, run `api`, `web`, and `mobile` locally against a seeded dev database in under 30 minutes.
- CI runs lint + test + build on every PR across all three apps.
- Staging environment is reachable and deploys automatically from `main`.
- Prisma schema covers all entities in PRD §10 and migrations run cleanly.
- Figma design system (or equivalent) covers core components used by Sprints 1–3.
- Firebase, Midtrans/Xendit (sandbox), Sentry, Google Maps, and WhatsApp BSP accounts exist with credentials in the secrets manager.
