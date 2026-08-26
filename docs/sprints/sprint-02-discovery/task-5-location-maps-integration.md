# Task 2.5 — Location & Maps Integration

**Sprint:** 2 — Tutor Discovery & Search
**Estimate:** 2 days

## Goal

City/area filtering and "nearest" sorting need real geocoding and distance calculation, per the Google Maps Platform recommendation in PRD §9.

## Scope

- Geocode tutor city/area (captured during [Task 1.5](../sprint-01-auth-onboarding/task-5-tutor-profile-completion.md) onboarding) into lat/lng using Google Geocoding API, stored on `TutorProfile`.
- Student location: device geolocation (with permission prompt) or manual city selection as fallback — required for "nearest" sort and city filter defaults.
- Distance calculation for "nearest" sort (Postgres `earthdistance`/PostGIS extension, or simple Haversine in the query — pick based on expected query volume; PostGIS is the more scalable choice if adopted early).
- City/area autocomplete component (mobile + web) backed by Google Places Autocomplete, scoped to Indonesia.

## Acceptance Criteria

- [ ] Tutor city/area is successfully geocoded on profile save; failures are logged, not silently dropped.
- [ ] Student can either grant device location or manually select a city, and either path feeds correctly into "nearest" sort.
- [ ] Distance-based sort produces correct ordering against seeded coordinates.
- [ ] City/area autocomplete only suggests Indonesian locations and is fast enough not to feel laggy while typing.

## Technical Notes

- Restrict Google Maps API key usage (from [Task 0.6](../sprint-00-foundation/task-6-third-party-accounts.md)) per-platform to avoid quota abuse.
- If PostGIS isn't already enabled on the Postgres instance, evaluate whether Railway/Render's managed Postgres supports the extension before committing to it over a simpler Haversine formula in raw SQL.

## Dependencies

- Sprint 0: [Third-Party Service Accounts](../sprint-00-foundation/task-6-third-party-accounts.md) (Google Maps key)
- Sprint 1: [Tutor Multi-Step Profile Completion](../sprint-01-auth-onboarding/task-5-tutor-profile-completion.md) (source city data)
