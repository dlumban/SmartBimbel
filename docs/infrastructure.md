# Infrastructure

Tracks what's provisioned, where, and what's still a manual step. See [Task 0.3](sprints/sprint-00-foundation/task-3-cloud-environments.md) and [Task 0.6](sprints/sprint-00-foundation/task-6-third-party-accounts.md).

## Environments

| Environment | Status | Notes |
|---|---|---|
| **Local dev** | ✅ Working | `docker compose up -d` runs Postgres (`localhost:5433`) + Redis (`localhost:6380`) on non-default ports to avoid colliding with other local services. `services/api`, `apps/web`, `apps/admin` run directly via `pnpm dev` (no containerization needed for app code in dev). |
| **Staging** | ⛔ Not provisioned | Requires a Railway (or Render) account + project for the API, and Vercel projects for `web`/`admin`. Deploy workflow already written ([.github/workflows/deploy-staging.yml](../.github/workflows/deploy-staging.yml)) but inert until the accounts exist and their secrets are added to the GitHub repo. |
| **Production** | ⛔ Not provisioned | Same as staging, plus a GitHub Environment named `production` with required reviewers configured, to satisfy the manual-approval gate in [deploy-production.yml](../.github/workflows/deploy-production.yml). |

## Why staging/production aren't provisioned yet

Creating Railway/Render/Vercel accounts and projects requires billing details and account ownership that belong to the project owner, not something that can be done on your behalf. To unblock:

1. Create a Railway (or Render) account, create a project, and add a Postgres + Redis service (or point `DATABASE_URL`/`REDIS_URL` at managed equivalents).
2. Create a Vercel account, import this repo (once pushed to GitHub) as two projects — one rooted at `apps/web`, one at `apps/admin`.
3. In the GitHub repo's Settings → Secrets, add: `RAILWAY_STAGING_TOKEN`, `RAILWAY_PRODUCTION_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_WEB_PROJECT_ID`, `VERCEL_ADMIN_PROJECT_ID`.
4. Create a `production` GitHub Environment (Settings → Environments) with required reviewers.
5. Push this repo to a GitHub remote — none of the GitHub Actions workflows can run without one.

## Local environment variables

Each app has a `.env.example` documenting its variables:

- [`services/api/.env.example`](../services/api/.env.example)
- [`apps/web/.env.example`](../apps/web/.env.example)
- [`apps/admin/.env.example`](../apps/admin/.env.example)

Copy to `.env` (Next.js apps also read `.env.local`) and fill in local/sandbox values. Real secrets are never committed — `.gitignore` excludes all `.env*` except the `.example` files.

## Third-party accounts

See [docs/third-party-setup.md](third-party-setup.md) for the full checklist (Firebase, Midtrans, Stream Chat, WhatsApp BSP, Sentry, Google Maps, Cloudinary, analytics). None of these have been created yet — same reasoning as staging/production above (billing/ownership requires the project owner). Every integration point in the codebase reads its credentials from environment variables and is written to degrade gracefully to a local/mock mode when they're unset (see each feature's own notes as they're built, sprint by sprint).

## Domain plan (not yet registered)

| Purpose | Domain |
|---|---|
| Web app (production) | `app.smartbimbel.id` |
| Admin panel (production) | `admin.smartbimbel.id` |
| API (production) | `api.smartbimbel.id` |
| Staging equivalents | `staging.app.smartbimbel.id`, etc. |

Domain registration and DNS cutover is a [Sprint 8](sprints/sprint-08-hardening-launch/README.md) activity.

## Monitoring

Uptime monitoring (Better Uptime / UptimeRobot pointed at `/api/health`) is not yet configured — also blocked on account creation. The `/api/health` endpoint it would monitor already exists and returns `{"status":"ok","timestamp":...}`.
