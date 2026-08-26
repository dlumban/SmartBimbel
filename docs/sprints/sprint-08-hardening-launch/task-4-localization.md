# Task 8.4 — Localization (Bahasa Indonesia + English)

**Sprint:** 8 — Hardening & Soft Launch
**Estimate:** 2 days

## Goal

PRD §7: "Full Bahasa Indonesia interface + English option. All prices in IDR." Consolidate and complete localization across everything built since Sprint 1, rather than leaving it as an afterthought.

## Scope

- Audit all UI copy across mobile, web, and admin for hardcoded strings; move to a localization framework (`flutter_localizations`/`intl` for mobile, `next-intl` or similar for web/admin) if not already in place from earlier sprints.
- Complete Bahasa Indonesia translations for every screen (primary language, per PRD §7) — this should already largely exist if teams wrote Indonesian copy natively during feature sprints; this task is the completeness/consistency pass.
- English translations as the secondary option, with a language switcher.
- IDR currency formatting consistency check (thousands separators, "Rp" prefix) across all price displays (tutor rates, booking amounts, transaction history, earnings dashboard).
- Date/time formatting consistent with Indonesian conventions and correctly timezone-aware (per [Sprint 3, Task 3.1](../sprint-03-booking/task-1-tutor-availability-management.md)'s WIB/WITA/WIT handling).

## Acceptance Criteria

- [ ] No hardcoded, untranslated strings remain in production UI (verified by a lint rule or scripted audit, not just spot-checking).
- [ ] Every screen renders correctly in both Bahasa Indonesia and English.
- [ ] All monetary values display consistently formatted IDR across the entire app.
- [ ] Language switching persists across sessions.

## Dependencies

- All feature sprints (0–7) functionally complete.
