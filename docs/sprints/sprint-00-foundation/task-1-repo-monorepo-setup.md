# Task 0.1 — Repository & Monorepo Structure Setup

**Sprint:** 0 — Foundation & Tech Setup
**Estimate:** 2 days

## Goal

Create the repository skeleton that every subsequent task builds inside, with a layout that keeps the Flutter app, two Next.js apps, and the NestJS API independently buildable but sharing types where it matters.

## Scope

- Initialize git repo, `.gitignore`, `.editorconfig`, root `README.md`.
- Set up pnpm workspaces for the JS/TS side: `apps/web`, `apps/admin`, `services/api`, `packages/shared`.
- Scaffold `apps/mobile` as a standalone Flutter project (not part of the pnpm workspace).
- `packages/shared`: TypeScript types/DTOs and Zod validation schemas consumed by `web`, `admin`, and `api`.
- Root-level scripts (`turbo.json` or plain pnpm scripts) for `dev`, `build`, `lint`, `test` across workspaces.
- Conventional commit / branch naming convention documented in `CONTRIBUTING.md`.
- Environment variable convention: `.env.example` per app, loaded via `dotenv`, never committed with real values.

## Acceptance Criteria

- [ ] `pnpm install && pnpm dev` boots `web`, `admin`, and `api` locally with hot reload.
- [ ] `flutter run` boots the mobile app skeleton against a local API base URL from `.env`.
- [ ] A type defined in `packages/shared` is importable and type-checked in both `web` and `services/api`.
- [ ] `CONTRIBUTING.md` documents branch naming, commit convention, and how to add a new package.
- [ ] No secrets committed; `.env.example` files exist for every app.

## Technical Notes

- Use pnpm workspaces + Turborepo for task caching across `web`/`admin`/`api`/`shared` — Flutter is excluded since it has its own build tooling.
- Keep `packages/shared` framework-agnostic (no NestJS or Next.js imports) so it stays importable from Flutter-adjacent tooling later if needed (e.g. OpenAPI-generated Dart client).

## Dependencies

None.
