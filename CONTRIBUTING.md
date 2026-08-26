# Contributing to SmartBimbel

## Repo layout

- `apps/web` — student/tutor-facing web app (Next.js)
- `apps/admin` — internal admin panel (Next.js)
- `apps/mobile` — Flutter app (currently deferred, see its README)
- `services/api` — backend API (NestJS)
- `packages/shared` — shared TypeScript types/DTOs/Zod schemas
- `packages/design-tokens` — shared color/type/spacing tokens consumed by Tailwind configs
- `docs/sprints` — sprint plan and per-task specs; each sprint folder has a `changes.md` log of what was actually built

## Getting started

```bash
pnpm install
docker compose up -d      # Postgres + Redis for local dev
pnpm --filter @smartbimbel/api prisma:migrate
pnpm dev                   # builds shared packages, then runs web/admin/api in watch mode
```

See each app's `.env.example` for required environment variables; copy to `.env` (or `.env.local` for Next.js apps) and fill in local/sandbox values.

## Adding a new package

1. Create `packages/<name>` (or `apps/<name>`) with its own `package.json` — name it `@smartbimbel/<name>`.
2. Add it to `pnpm-workspace.yaml` if it doesn't already match an existing glob.
3. Reference it from a consumer via `"@smartbimbel/<name>": "workspace:*"`.
4. Give it `build`, `lint`, `test`, and `typecheck` scripts consistent with the other packages so `turbo run <task>` picks it up automatically.

## Branching & commits

- Branch names: `<type>/<short-description>`, e.g. `feat/tutor-search-filters`, `fix/booking-race-condition`.
- Commit messages: conventional-commit style (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`) with a short imperative summary.
- One sprint task ≈ one PR where practical, referencing the task file (e.g. `docs/sprints/sprint-02-discovery/task-2-tutor-listing-api.md`).

## Before opening a PR

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI (`.github/workflows/lint-test-build.yml`) runs the same checks — see [Task 0.2](docs/sprints/sprint-00-foundation/task-2-cicd-pipeline.md).
