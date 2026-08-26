# Design System

Companion doc to [Task 0.5](sprints/sprint-00-foundation/task-5-design-system.md). Covers what actually exists, what's deferred, and why.

## What exists

- **`packages/design-tokens`** — the single source of truth for color, typography, spacing, and shadow values. Colors are close derivatives of Tailwind's own indigo/orange/slate scales specifically because those are pre-vetted for accessible contrast at the 600-700 steps; see verification below.
- **`packages/ui`** — a shared React component library (`Button`, `Badge`, `Card`, `Input`, `Modal`, `RatingStars`, `EmptyState`, `ErrorState`, `LoadingSpinner`, `TutorCard`) consumed directly from source by both `apps/web` and `apps/admin` via Next.js `transpilePackages`. Every interactive component is marked `"use client"` (App Router requires this for anything using hooks or attaching event handlers).
- Both `apps/web`'s homepage and `apps/admin`'s homepage render real content built only from `packages/ui` components (`TutorCard`/`Badge` on web, `Card`/`Badge` on admin) — this is the "sample screen in both apps, visually consistent" proof called for in the task, scoped to the two Next.js apps (see Flutter note below).

## Accessibility

WCAG AA contrast (≥4.5:1 for normal text, ≥3:1 for large text) was checked against every foreground/background text pairing actually used in the components (computed via the standard relative-luminance formula, not eyeballed):

| Pairing | Ratio | Result |
|---|---|---|
| Body text (neutral-900 / neutral-50) | 17.06 | Pass |
| Button text (white / primary-600) | 6.29 | Pass |
| Verified badge (primary-700 / primary-100) | 6.41 | Pass |
| Online badge (success-700 / success-50) | 5.21 | Pass |
| Warning badge (warning-700 / warning-50) | 4.84 | Pass |
| Error text (danger-700 / danger-50) | 5.91 | Pass |
| Secondary button (neutral-900 / neutral-100) | 16.30 | Pass |
| Ghost button / links (primary-700 / white) | 7.90 | Pass |
| Muted text (neutral-600 / white) | 7.58 | Pass |
| Smallest muted text (neutral-500 / white) | 4.76 | Pass |

One real failure was caught and fixed during this check: `TutorCard`'s avatar-initial placeholder originally used `text-neutral-400` on `bg-neutral-100` (ratio 2.34, fails even the large-text threshold) — changed to `text-neutral-600` (ratio 6.92). `disabled:text-neutral-400` states in `Button` were left as-is; WCAG 1.4.3 explicitly excludes disabled UI components from the contrast requirement.

Minimum tap target: `Button` (md/lg) and `Input` enforce `min-h-11` (44px), matching `design-tokens`' `minTapTarget` value, per PRD §7's mobile-first requirement.

## Deferred

- **Figma file.** Design tooling requires a human designer working in Figma directly — nothing to build here in code. The token values in `packages/design-tokens` are the values a designer would import as Figma variables/styles when that file gets created.
- **Flutter `ThemeData`.** Mobile is deferred in this build pass (see [`apps/mobile/README.md`](../apps/mobile/README.md)). When Flutter work resumes, port `packages/design-tokens`' color/type/spacing values by hand into a `ThemeData` — there's no codegen bridge between the TS tokens and Dart today, which is worth building if/when both platforms are actively maintained in parallel.
- **Cross-platform visual consistency check** is therefore scoped to web + admin only for now, not web + admin + mobile as originally written.
