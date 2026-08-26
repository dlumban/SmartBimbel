# Sprint 2 — Tutor Discovery & Search

**Duration:** 2 weeks
**PRD reference:** §6.1.B

## Goal

A student/parent can browse, filter, search, and drill into tutor profiles — the "Discover" step of the PRD §8 happy path.

## Scope

1. [Subjects & Grade Levels Master Data Management](task-1-subjects-gradelevels-master-data.md)
2. [Tutor Listing API](task-2-tutor-listing-api.md)
3. [Search & Filters](task-3-search-filters.md)
4. [Tutor Detail Profile Page](task-4-tutor-detail-page.md)
5. [Location & Maps Integration](task-5-location-maps-integration.md)
6. [Discovery UI (Mobile + Web)](task-6-discovery-ui.md)

## Dependencies

- Sprint 1 complete: verified tutors with complete profiles exist to search over.
- Seed data: enough test tutors across subjects/cities to meaningfully exercise filters (extend Sprint 0's seed script).

## Exit Criteria

- Student can browse a paginated tutor list with photo, name, subjects, rate, rating, location, and mode badge.
- Filters (subject, grade level, price range, city, rating, mode, availability) combine correctly and are reflected in the URL/state (shareable/bookmarkable on web).
- Keyword search returns relevant tutors; sorting by rating/price/nearest works.
- Tutor detail page shows full profile, reviews (empty state until Sprint 6 ships reviews), and a "Book Now" CTA that leads into Sprint 3's flow (can be a stub route until Sprint 3 lands).
- Only `VERIFIED` tutors appear in results.
