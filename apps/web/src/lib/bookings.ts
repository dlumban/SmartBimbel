import { BadgeVariant } from "@smartbimbel/ui";
import { AllowedBookingDurationMinutes } from "@smartbimbel/shared";
import { apiFetch } from "./api";

export type BookingStatus =
  | "REQUESTED"
  | "COUNTER_PROPOSED"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "RESCHEDULE_PROPOSED";

export type BookingBucket = "upcoming" | "past" | "cancelled";

export type CancellationReasonCode =
  | "SCHEDULE_CONFLICT"
  | "ILLNESS"
  | "FOUND_ALTERNATIVE"
  | "NO_LONGER_NEEDED"
  | "OTHER";

export const CANCELLATION_REASON_LABELS: Record<CancellationReasonCode, string> = {
  SCHEDULE_CONFLICT: "Jadwal bentrok",
  ILLNESS: "Sakit",
  FOUND_ALTERNATIVE: "Menemukan alternatif lain",
  NO_LONGER_NEEDED: "Tidak jadi butuh",
  OTHER: "Lainnya",
};

interface BookingUser {
  id: string;
  name: string | null;
}

interface BookingParticipant {
  userId: string;
  user: BookingUser;
}

export interface Booking {
  id: string;
  scheduledAt: string;
  proposedScheduledAt: string | null;
  // Who created this booking - null means student-initiated (either a
  // genuinely old booking, or the normal student-picks-a-tutor flow).
  // Set to the tutor's own userId for a tutor-initiated booking, which
  // flips who's expected to respond while the booking is
  // REQUESTED/COUNTER_PROPOSED (see BookingDetail's canRespondToRequest).
  requestedByUserId: string | null;
  rescheduleProposedByUserId: string | null;
  durationMinutes: number;
  mode: "ONLINE" | "OFFLINE";
  status: BookingStatus;
  notes: string | null;
  declineReason: string | null;
  respondByAt: string | null;
  cancellationReasonCode: CancellationReasonCode | null;
  cancellationReason: string | null;
  isLateCancellation: boolean;
  noShowReported: boolean;
  meetingLink: string | null;
  meetingAddress: string | null;
  // Locked in at request time (Task 5.2) - null only for bookings created
  // before a tutor ever set an hourly rate is no longer possible, but the
  // field stays nullable to match the Prisma schema.
  priceAmount: number | null;
  // Set when this booking was scheduled against an admin-managed
  // fixed-price package - see ScheduleSessionForm's package selector.
  packageId: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  sessionNotes: string | null;
  sessionNotesUpdatedAt: string | null;
  student: BookingParticipant;
  tutor: BookingParticipant;
  subject: { id: string; name: string };
  createdAt: string;
}

export interface BookingHistoryEntry {
  id: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  changedByUserId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface PaginatedBookings {
  data: Booking[];
  total: number;
  page: number;
  limit: number;
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  REQUESTED: "Menunggu konfirmasi",
  COUNTER_PROPOSED: "Usulan waktu baru",
  ACCEPTED: "Diterima",
  CONFIRMED: "Terkonfirmasi",
  DECLINED: "Ditolak",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
  COMPLETED: "Selesai",
  RESCHEDULE_PROPOSED: "Usulan jadwal ulang",
};

export const BOOKING_STATUS_BADGE_VARIANT: Record<BookingStatus, BadgeVariant> = {
  REQUESTED: "warning",
  COUNTER_PROPOSED: "warning",
  ACCEPTED: "online",
  CONFIRMED: "verified",
  DECLINED: "offline",
  EXPIRED: "offline",
  CANCELLED: "offline",
  COMPLETED: "verified",
  RESCHEDULE_PROPOSED: "warning",
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function listBookings(
  params: { bucket?: BookingBucket; page?: number; limit?: number } = {},
): Promise<PaginatedBookings> {
  const qs = new URLSearchParams();
  if (params.bucket) qs.set("bucket", params.bucket);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return handle(await apiFetch(`/bookings${query ? `?${query}` : ""}`));
}

/**
 * Fetches every booking for the current user regardless of bucket, paging
 * through the 50-per-request server cap (see ListBookingsDto) until the
 * reported total is reached. Used by BookingCalendar, which needs a full
 * month's bookings up front rather than one bucket/page at a time - fine
 * at MVP scale, revisit with a server-side date-range filter if a tutor's
 * booking count ever makes this slow.
 */
export async function listAllBookings(): Promise<Booking[]> {
  const all: Booking[] = [];
  let page = 1;
  const limit = 50;
  for (;;) {
    const res = await listBookings({ page, limit });
    all.push(...res.data);
    if (all.length >= res.total || res.data.length === 0) break;
    page += 1;
  }
  return all;
}

export async function getBooking(id: string): Promise<Booking> {
  return handle(await apiFetch(`/bookings/${id}`));
}

export async function getBookingHistory(id: string): Promise<BookingHistoryEntry[]> {
  return handle(await apiFetch(`/bookings/${id}/history`));
}

export async function acceptBooking(id: string): Promise<Booking> {
  return handle(await apiFetch(`/bookings/${id}/accept`, { method: "PATCH" }));
}

export async function declineBooking(id: string, reason?: string): Promise<Booking> {
  return handle(
    await apiFetch(`/bookings/${id}/decline`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  );
}

export async function counterProposeBooking(
  id: string,
  proposedDate: string,
  proposedTime: string,
): Promise<Booking> {
  return handle(
    await apiFetch(`/bookings/${id}/counter-propose`, {
      method: "PATCH",
      body: JSON.stringify({ proposedDate, proposedTime }),
    }),
  );
}

export async function proposeReschedule(
  id: string,
  proposedDate: string,
  proposedTime: string,
): Promise<Booking> {
  return handle(
    await apiFetch(`/bookings/${id}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify({ proposedDate, proposedTime }),
    }),
  );
}

export async function acceptReschedule(id: string): Promise<Booking> {
  return handle(await apiFetch(`/bookings/${id}/reschedule/accept`, { method: "PATCH" }));
}

export async function declineReschedule(id: string): Promise<Booking> {
  return handle(await apiFetch(`/bookings/${id}/reschedule/decline`, { method: "PATCH" }));
}

export async function cancelBooking(
  id: string,
  reasonCode: CancellationReasonCode,
  details?: string,
): Promise<Booking> {
  return handle(
    await apiFetch(`/bookings/${id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ reasonCode, details }),
    }),
  );
}

/** Tutor soft-delete: removes the session from calendars while keeping the DB row. */
export async function deleteBooking(id: string): Promise<{ id: string; deletedAt: string }> {
  return handle(await apiFetch(`/bookings/${id}`, { method: "DELETE" }));
}

// Direct edit of a CONFIRMED, tutor-scheduled booking - no counterparty
// approval, only legal for sessions the tutor created themselves (enforced
// server-side in BookingsService.editForTutor). Every field is optional
// since only changed fields need to be sent.
export interface EditBookingInput {
  scheduledDate?: string;
  startTime?: string;
  durationMinutes?: AllowedBookingDurationMinutes;
  subjectId?: string;
  mode?: "ONLINE" | "OFFLINE";
  notes?: string;
}

export async function editBooking(id: string, input: EditBookingInput): Promise<Booking> {
  return handle(
    await apiFetch(`/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function reportNoShow(id: string): Promise<Booking> {
  return handle(await apiFetch(`/bookings/${id}/no-show`, { method: "PATCH" }));
}

export async function completeBooking(id: string): Promise<Booking> {
  return handle(await apiFetch(`/bookings/${id}/complete`, { method: "PATCH" }));
}

export async function addSessionNotes(id: string, notes: string): Promise<Booking> {
  return handle(
    await apiFetch(`/bookings/${id}/notes`, { method: "PATCH", body: JSON.stringify({ notes }) }),
  );
}

export async function setMeeting(
  id: string,
  input: { meetingLink?: string; meetingAddress?: string },
): Promise<Booking> {
  return handle(
    await apiFetch(`/bookings/${id}/meeting`, { method: "PATCH", body: JSON.stringify(input) }),
  );
}

export interface BookingAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

// Uploads an image to embed inline in session notes - returns only the id,
// which the editor embeds as `attachment:<id>` (see sanitizeHtml.ts and
// hydrateAttachmentImages.ts), never a real, browser-fetchable URL.
export async function uploadSessionImage(bookingId: string, file: File): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return handle(
    await apiFetch(`/bookings/${bookingId}/attachments/image`, { method: "POST", body: formData }),
  );
}

// Uploads a standalone document attached to the session report, distinct
// from an inline image.
export async function uploadSessionDocument(
  bookingId: string,
  file: File,
): Promise<BookingAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  return handle(
    await apiFetch(`/bookings/${bookingId}/attachments/document`, {
      method: "POST",
      body: formData,
    }),
  );
}

export async function listSessionAttachments(bookingId: string): Promise<BookingAttachment[]> {
  return handle(await apiFetch(`/bookings/${bookingId}/attachments`));
}

export async function deleteSessionAttachment(
  bookingId: string,
  attachmentId: string,
): Promise<void> {
  const res = await apiFetch(`/bookings/${bookingId}/attachments/${attachmentId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to delete attachment (${res.status})`);
  }
}

// Raw bytes for one attachment - used both for downloading a document and
// for hydrating an inline image's real src (see hydrateAttachmentImages.ts).
export async function fetchAttachmentBlob(bookingId: string, attachmentId: string): Promise<Blob> {
  const res = await apiFetch(`/bookings/${bookingId}/attachments/${attachmentId}`);
  if (!res.ok) {
    throw new Error(`Failed to load attachment (${res.status})`);
  }
  return res.blob();
}

export interface CreateBookingInput {
  tutorId: string;
  startTime: string;
  subjectId: string;
  scheduledDate: string;
  durationMinutes: AllowedBookingDurationMinutes;
  mode: "ONLINE" | "OFFLINE";
  notes?: string;
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  return handle(
    await apiFetch("/bookings", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

// Same POST /bookings endpoint as createBooking, but for a TUTOR
// scheduling a session directly with a student (studentId instead of
// tutorId - the backend infers the tutor from the caller's own profile).
// Kept as a sibling function rather than folding into CreateBookingInput
// since the two payload shapes genuinely differ by caller role.
export interface ScheduleSessionInput {
  studentId: string;
  startTime: string;
  subjectId: string;
  scheduledDate: string;
  durationMinutes: AllowedBookingDurationMinutes;
  mode: "ONLINE" | "OFFLINE";
  notes?: string;
  // When set, overrides normal hourly-rate pricing with the package's
  // fixed totalPrice/sessionCount (see PackagesService, BookingsService.create).
  packageId?: string;
}

export async function scheduleSession(input: ScheduleSessionInput): Promise<Booking> {
  return handle(
    await apiFetch("/bookings", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export interface BulkScheduleSlot {
  scheduledDate: string;
  startTime: string;
}

export interface BulkScheduleResult {
  succeeded: Booking[];
  failed: { slot: BulkScheduleSlot; error: string }[];
}

export async function scheduleSessionsBulk(
  base: Omit<ScheduleSessionInput, "scheduledDate" | "startTime">,
  slots: BulkScheduleSlot[],
): Promise<BulkScheduleResult> {
  const succeeded: Booking[] = [];
  const failed: BulkScheduleResult["failed"] = [];
  for (const slot of slots) {
    try {
      const booking = await scheduleSession({
        ...base,
        scheduledDate: slot.scheduledDate,
        startTime: slot.startTime,
      });
      succeeded.push(booking);
    } catch (e) {
      failed.push({
        slot,
        error: e instanceof Error ? e.message : "Gagal menjadwalkan sesi.",
      });
    }
  }
  return { succeeded, failed };
}
