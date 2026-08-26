# Task 2.6 — Discovery UI (Mobile + Web)

**Sprint:** 2 — Tutor Discovery & Search
**Estimate:** 4 days

## Goal

Ship the actual browse/search/filter/detail screens using the APIs from Tasks 2.1–2.5 and the design system from [Task 0.5](../sprint-00-foundation/task-5-design-system.md).

## Scope

- Tutor list/grid view (mobile: list; web: responsive grid) using the shared tutor card component.
- Filter panel/bottom sheet (mobile) and sidebar/dropdowns (web) for subject, grade level, price range, city, rating, mode, availability.
- Search bar with debounced keyword input.
- Sort control (rating / price / nearest).
- Infinite scroll or pagination controls consuming [Task 2.2](task-2-tutor-listing-api.md)'s pagination.
- Tutor detail screen consuming [Task 2.4](task-4-tutor-detail-page.md).
- Loading, empty ("no tutors match your filters"), and error states for every screen.
- Web: filter/search state reflected in the URL query string so results are shareable/bookmarkable.

## Acceptance Criteria

- [ ] A user can search, filter, and sort tutors on both mobile and web with consistent behavior.
- [ ] Filter panel state persists during the session (doesn't reset on navigating to detail and back).
- [ ] Empty and error states are handled gracefully, not blank screens or unhandled exceptions.
- [ ] Web filter state is reflected in the URL and restores correctly on page reload.
- [ ] Performance: initial list render is perceived as fast on a throttled connection (PRD §7: sub-3s on typical 4G) — verify with Chrome DevTools network throttling.

## Technical Notes

- Reuse the shared component library from [Task 0.5](../sprint-00-foundation/task-5-design-system.md) rather than building one-off cards/filters per platform.

## Dependencies

- [Task 2.2 — Tutor Listing API](task-2-tutor-listing-api.md)
- [Task 2.3 — Search & Filters](task-3-search-filters.md)
- [Task 2.4 — Tutor Detail Profile Page](task-4-tutor-detail-page.md)
- [Task 2.5 — Location & Maps Integration](task-5-location-maps-integration.md)
