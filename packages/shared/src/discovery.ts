/**
 * Shared response contract for tutor discovery, consumed by web/admin/api
 * alike (Task 2.2's own acceptance criterion) so the shape never drifts
 * between the backend and any frontend.
 */
export interface TutorListItem {
  id: string;
  name: string | null;
  photoUrl: string | null;
  bio: string | null;
  subjects: string[];
  gradeLevels: string[];
  hourlyRate: number | null;
  // Recomputed on every non-flagged Review write (Sprint 6, Task 6.5) -
  // null/0 until the tutor's first review.
  rating: number | null;
  reviewCount: number;
  city: string | null;
  teachingModes: ("ONLINE" | "OFFLINE")[];
  distanceKm?: number;
}

export interface PaginatedTutorList {
  data: TutorListItem[];
  page: number;
  limit: number;
  total: number;
}

/**
 * Full tutor profile view (Task 2.4).
 */
export interface TutorDetail extends TutorListItem {
  education: string | null;
  // TutorListItem's `subjects` is names-only (fine for display) - the
  // booking flow (Task 3.7) needs the id to submit CreateBookingDto,
  // hence this parallel, detail-only field rather than changing the
  // widely-used list shape.
  subjectOptions: { id: string; name: string }[];
}

// GET /tutors/:id/schedule response - deliberately minimal (no student
// identity) so a prospective student can render a busy/free calendar
// before booking (no more declared AvailabilitySlot to show instead).
export interface TutorScheduleBlock {
  scheduledAt: string;
  durationMinutes: number;
}

// A single review as shown on a tutor's public profile (Task 6.5) -
// flagged reviews are never included, so there's no `flagged` field here
// (unlike the booking-scoped Review the reviewer themselves can see).
export interface TutorReview {
  id: string;
  rating: number;
  text: string | null;
  createdAt: string;
  studentName: string | null;
}

export interface PaginatedTutorReviews {
  data: TutorReview[];
  page: number;
  limit: number;
  total: number;
}
