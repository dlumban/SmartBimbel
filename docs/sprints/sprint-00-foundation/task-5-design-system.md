# Task 0.5 — Design System & UI Kit

**Sprint:** 0 — Foundation & Tech Setup
**Estimate:** 4 days

## Goal

Give mobile, web, and admin a shared visual language so feature sprints ship consistent UI without re-litigating spacing, color, and component decisions every task.

## Scope

- Figma file: color palette, typography scale, spacing scale, elevation/shadow tokens — Bahasa Indonesia-first copy conventions (PRD §7 localization).
- Core component set in Figma: buttons, inputs, cards, tutor list card, rating stars, badges (online/offline, verified), modals, bottom sheets, empty/error/loading states.
- Flutter implementation: theme file (`ThemeData`), shared widget library (`packages/mobile_ui` or `apps/mobile/lib/design_system`) for the components above.
- Next.js implementation: Tailwind config (or CSS variables) matching the same tokens, shared component library in `packages/shared` or a dedicated `packages/ui` consumed by `web` and `admin`.
- Accessibility baseline: color contrast checked against WCAG AA, minimum tap target sizes for mobile.

## Acceptance Criteria

- [ ] Figma file covers every component needed for Sprints 1–3 (auth forms, tutor cards, filters, booking calendar, chat bubbles).
- [ ] Flutter theme and Next.js Tailwind config both derive from the same token values (documented in one place, not duplicated by memory).
- [ ] A sample screen (e.g. tutor list) is implemented in both Flutter and Next.js using only shared components, and looks visually consistent between them.
- [ ] Color contrast for primary text/background combinations passes WCAG AA.

## Technical Notes

- Don't over-invest in a fully custom design system before there's a real screen to validate it against — build tokens + the ~10 components actually needed for Sprint 1–2, extend as later sprints need new patterns.
- English is a secondary language option per PRD §7; design copy length assuming Bahasa Indonesia strings, which tend to run longer than English equivalents.

## Dependencies

None (can run in parallel with Tasks 0.1–0.4).
