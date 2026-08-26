# Rollback Plan (Task 8.6)

Covers the two things that can go wrong on a bad production deploy: the application code, and the database schema. These are handled separately because they roll back on different timelines and with different risk profiles.

## Application rollback

The three deployable units (`services/api`, `apps/web`, `apps/admin`) are independent Docker/Node deployments with no shared runtime state beyond the database and Redis, so any one of them can be rolled back alone without touching the others.

1. Redeploy the previous known-good build/image tag. Since no build ever runs a destructive migration itself (see below), redeploying an older API build against a newer database schema is safe as long as the migration that introduced the schema change was purely additive (the default for every migration in this project so far — see `services/api/prisma/migrations/`).
2. Confirm health: `GET /api/health` returns 200, and the Sentry dashboard (Task 8.5, once `SENTRY_DSN` is configured) shows the error rate returning to baseline within a few minutes.
3. Announce the rollback in the incident channel (see `launch-runbook.md`) with the reverted-to version so the on-call engineer for the *next* shift has continuity.

## Database migration rollback

Prisma Migrate (`prisma migrate deploy`, used in production per every `prisma:deploy` script) does not support automatic "down" migrations — this is a deliberate Prisma design choice, not a gap in this project. The rollback strategy is therefore:

- **Prefer forward fixes over reverting migrations.** A migration that turns out to be wrong is usually safer to fix with a new, small corrective migration than to attempt reversing an already-applied one, especially once real user data exists in the changed columns/tables.
- **Every migration so far in this project is additive** (new tables, new nullable columns, new enums, new indexes — see the migration history: `admin_rbac_audit_log`, `sessions_reviews_ratings`, etc.) — none of them drop or rename a column/table that existing code depends on. This is intentional: additive migrations mean an application rollback (previous code against the new schema) never breaks, because the old code simply ignores the new columns/tables it doesn't know about.
- **If a genuinely destructive migration is ever needed** (a column rename or drop), it must ship as two separate deploys: (1) a migration + code change that stops using the old column but doesn't drop it, deployed and verified first; (2) a later migration that drops the now-unused column, only after (1) has been stable in production for a full deploy cycle. This is standard expand/contract migration practice and should be treated as a hard rule going forward, not a case-by-case judgment call.
- **Point-in-time recovery** via the managed Postgres provider's own backup/restore (whichever is chosen at real deployment time — no production Postgres host is provisioned in this environment, see `docs/third-party-setup.md`) is the last-resort option for a migration that already corrupted data before being caught. This should only ever be needed if the additive-migration rule above was violated.

## What this environment could not verify

This plan is written from the schema/migration history and Prisma's documented behavior, not from an actual rehearsed rollback against a staging deployment — no staging or production infrastructure exists yet in this environment (per the Sprint 8 "Engineering-only pass" scope). Before the real soft launch, run at least one rehearsal: deploy a migration to a staging environment, deploy the previous API build alongside it, and confirm nothing breaks.
