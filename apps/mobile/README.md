# SmartBimbel Mobile (Flutter) — Deferred

Per an explicit scoping decision made at the start of the build (2026-08-11), the Flutter mobile app is **deferred**. This environment doesn't have the Flutter SDK / Android toolchain installed, and setting that up was scoped out in favor of building backend + web + admin first.

## What this means

- Every sprint task that specifically targets Flutter/mobile UI is not implemented in this pass — only its web equivalent is.
- The architecture is unaffected: `packages/shared` (TypeScript types/DTOs) and the NestJS API are platform-agnostic, so a Flutter app can consume the same API contracts later without backend changes.
- `packages/design-tokens` documents color/type/spacing values as plain data — when Flutter work resumes, port these into a `ThemeData` by hand (see [Task 0.5](../../docs/sprints/sprint-00-foundation/task-5-design-system.md)); there's no automated Dart codegen from these tokens yet.

## To resume mobile work

1. Install the Flutter SDK and Android command-line tools.
2. Run `flutter create .` in this directory (or scaffold manually) targeting a min SDK consistent with PRD §7's "mid-range Android" requirement.
3. Point the app's HTTP client at `services/api` (see its `.env.example` for the local port) and Firebase Auth config at the same Firebase project used by `apps/web`.
4. Revisit the sprint docs' Flutter-specific acceptance criteria, which were skipped in the initial build pass — see each sprint's `changes.md` for exactly what was deferred.
