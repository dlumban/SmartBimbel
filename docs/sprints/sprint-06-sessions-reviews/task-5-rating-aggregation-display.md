# Task 6.5 — Tutor Profile Rating Aggregation Display

**Sprint:** 6 — Session Management & Reviews
**Estimate:** 1 day

## Goal

PRD §6.1.G: "Average rating and recent reviews displayed on tutor profiles" — closes the loop back to [Sprint 2](../sprint-02-discovery/task-4-tutor-detail-page.md)'s previously-empty reviews section, and feeds the "Average Session Rating ≥ 4.5" success metric from PRD §3.

## Scope

- Aggregate rating calculation on `TutorProfile` (average + count), recalculated on each new review (trigger or scheduled recompute — pick based on write volume; a simple recalculation on write is fine at MVP scale).
- Update [Sprint 2, Task 2.4](../sprint-02-discovery/task-4-tutor-detail-page.md)'s tutor detail page to show real average rating and a paginated list of recent reviews (previously an empty state).
- Update [Sprint 2, Task 2.2](../sprint-02-discovery/task-2-tutor-listing-api.md)'s listing endpoint to include the real rating instead of the placeholder used before reviews existed.
- Rating filter/sort in [Sprint 2, Task 2.3](../sprint-02-discovery/task-3-search-filters.md) now operates on real data — verify it still behaves correctly with populated ratings.

## Acceptance Criteria

- [ ] Tutor detail page shows accurate average rating and recent reviews, replacing the Sprint 2 empty state.
- [ ] Tutor list/search results reflect real ratings, and rating-based sort/filter produce correct results against real data.
- [ ] A new review updates the tutor's aggregate rating immediately (or within an acceptable short delay if computed asynchronously).
- [ ] Flagged reviews ([Task 6.4](task-4-ratings-reviews-system.md)) are excluded from the public-facing average until cleared by admin review.

## Dependencies

- [Task 6.4 — Ratings & Reviews System](task-4-ratings-reviews-system.md)
- Sprint 2: [Tutor Listing API](../sprint-02-discovery/task-2-tutor-listing-api.md), [Tutor Detail Profile Page](../sprint-02-discovery/task-4-tutor-detail-page.md)
