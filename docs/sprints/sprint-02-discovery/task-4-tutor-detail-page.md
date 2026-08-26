# Task 2.4 — Tutor Detail Profile Page

**Sprint:** 2 — Tutor Discovery & Search
**Estimate:** 2 days

## Goal

The full tutor profile view described in PRD §6.1.B: reviews, availability calendar, and a "Book Now" CTA.

## Scope

- `GET /tutors/:id`: full profile — photo, bio, subjects, grade levels, rate(s), mode, city, education background, rating summary, recent reviews (reviews list can be a stub/empty state until [Sprint 6](../sprint-06-sessions-reviews/README.md) ships the review system).
- Availability calendar view: read-only display of the tutor's open slots (data model exists from Sprint 0/1; full slot management UI is [Sprint 3, Task 3.1](../sprint-03-booking/task-1-tutor-availability-management.md)).
- "Book Now" CTA: routes into the booking flow. If [Sprint 3](../sprint-03-booking/README.md) hasn't shipped yet in a parallel-track team, this can route to a "coming soon" stub — but the button and route must exist now so Sprint 3 only has to implement the destination, not retrofit the entry point.
- 404 handling for non-existent or unverified tutor IDs (don't leak existence of unverified profiles).

## Acceptance Criteria

- [ ] Detail page renders all profile fields correctly for a seeded tutor.
- [ ] Availability calendar reflects actual `AvailabilitySlot` data for that tutor.
- [ ] "Book Now" is present and wired to a route (real or stub).
- [ ] Requesting an unverified or non-existent tutor ID returns 404, not partial data.

## Technical Notes

- Keep the reviews section's empty state intentional ("Belum ada ulasan" / "No reviews yet") rather than a broken-looking blank area — it'll be populated once [Sprint 6](../sprint-06-sessions-reviews/README.md) ships.

## Dependencies

- [Task 2.2 — Tutor Listing API](task-2-tutor-listing-api.md)
