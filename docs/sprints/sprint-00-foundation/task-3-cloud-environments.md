# Task 0.3 — Cloud Environments (Dev / Staging / Prod)

**Sprint:** 0 — Foundation & Tech Setup
**Estimate:** 2 days

## Goal

Provision the infrastructure the app runs on for local development, staging, and production, matching PRD §9's hosting recommendation.

## Scope

- Provision Postgres + Redis on Railway/Render for staging and production (separate instances, not shared).
- Local dev: `docker-compose.yml` running Postgres + Redis for developer machines.
- Provision Vercel projects for `web` and `admin` with staging/production environments.
- Configure environment variable groups per environment (dev/staging/prod) for API keys, DB URLs, Firebase config.
- Set up domain/subdomain plan (e.g. `app.smartbimbel.id`, `admin.smartbimbel.id`, `api.smartbimbel.id`, staging equivalents) — actual DNS cutover can wait until Sprint 8.
- Basic uptime monitoring (e.g. Better Uptime / UptimeRobot) pointed at staging and later production health check endpoints.

## Acceptance Criteria

- [ ] `docker-compose up` gives every developer a working local Postgres + Redis.
- [ ] Staging API, web, and admin are reachable over HTTPS at staging subdomains.
- [ ] Production infrastructure exists (even if not yet publicly linked) and is provisioned identically to staging.
- [ ] A `/health` endpoint on the API returns 200 and is monitored.
- [ ] Environment variables are documented in `docs/infrastructure.md` (which env holds what, and where it's set).

## Technical Notes

- Keep staging and production on separate Railway/Render projects — never share a database across environments.
- Target 99.5%+ uptime per PRD §7; monitoring set up now makes that measurable from day one instead of retrofitted before launch.

## Dependencies

- [Task 0.1 — Repository & Monorepo Structure Setup](task-1-repo-monorepo-setup.md)
