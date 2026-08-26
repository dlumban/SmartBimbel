# Task 2.3 — Search & Filters

**Sprint:** 2 — Tutor Discovery & Search
**Estimate:** 3 days

## Goal

Implement the filter and sort surface described in PRD §6.1.B: subject, grade level, price range, city/area, rating, teaching mode, availability, plus keyword search and sort by rating/price/nearest.

## Scope

- Extend `GET /tutors` (from [Task 2.2](task-2-tutor-listing-api.md)) with query params: `subject`, `gradeLevel`, `priceMin`/`priceMax`, `city`, `ratingMin`, `mode`, `availableOn` (date/time), `q` (keyword), `sort` (`rating`, `price`, `nearest`).
- Keyword search across tutor name and bio — Postgres full-text search (`tsvector`) is sufficient for MVP scale; no need for Elasticsearch/Algolia yet.
- "Nearest" sort requires student location (from profile or device geolocation) and tutor city/coordinates — coordinate with [Task 2.5](task-5-location-maps-integration.md).
- "Availability" filter cross-references `AvailabilitySlot` to only show tutors with an open slot matching the requested window.
- Filter combination logic tested (e.g. subject + price range + city simultaneously).

## Acceptance Criteria

- [ ] Each filter works in isolation and in combination with at least two others, verified by tests.
- [ ] Keyword search returns relevant results for partial name/bio matches.
- [ ] Sort by price and rating produce correctly ordered results; sort by "nearest" requires and correctly uses a location input.
- [ ] Availability filter correctly excludes tutors with no matching open slot.
- [ ] Invalid filter combinations (e.g. `priceMin > priceMax`) return a clear validation error, not silently wrong results.

## Technical Notes

- Don't reach for a dedicated search engine (Elasticsearch/Algolia) at MVP data volumes — Postgres full-text search plus well-indexed filter columns is sufficient and keeps infra simple. Revisit only if search relevance or scale becomes a real problem post-launch.

## Dependencies

- [Task 2.2 — Tutor Listing API](task-2-tutor-listing-api.md)
- [Task 2.5 — Location & Maps Integration](task-5-location-maps-integration.md) (for "nearest" sort)
