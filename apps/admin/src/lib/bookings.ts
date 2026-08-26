import { apiFetch } from "./api";

export type AdminBookingStatus =
  | "REQUESTED"
  | "COUNTER_PROPOSED"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "RESCHEDULE_PROPOSED";

export const ADMIN_BOOKING_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Menunggu konfirmasi",
  COUNTER_PROPOSED: "Usulan waktu lain",
  ACCEPTED: "Diterima",
  DECLINED: "Ditolak",
  EXPIRED: "Kedaluarsa",
  CONFIRMED: "Terkonfirmasi",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  RESCHEDULE_PROPOSED: "Usulan jadwal ulang",
};

export interface AdminBookingListItem {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: "ONLINE" | "OFFLINE";
  status: string;
  notes: string | null;
  student: { user: { id: string; name: string | null } };
  tutor: { user: { id: string; name: string | null }; city: string | null };
  subject: { id: string; name: string };
  transaction?: { status: string; amount: number; commission: number } | null;
}

export interface AdminBookingHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}

export interface AdminBookingDetail extends AdminBookingListItem {
  declineReason: string | null;
  cancellationReason: string | null;
  cancellationReasonCode: string | null;
  isLateCancellation: boolean;
  noShowReported: boolean;
  meetingLink: string | null;
  meetingAddress: string | null;
  sessionNotes: string | null;
  sessionNotesUpdatedAt: string | null;
  completedAt: string | null;
  proposedScheduledAt: string | null;
  statusHistory: AdminBookingHistoryEntry[];
  review: { id: string; rating: number; text: string | null; flagged: boolean; createdAt: string } | null;
}

export interface PaginatedAdminBookings {
  data: AdminBookingListItem[];
  total: number;
  page: number;
  limit: number;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function searchBookings(
  params: {
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    city?: string;
    subjectId?: string;
  } = {},
): Promise<PaginatedAdminBookings> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.city) qs.set("city", params.city);
  if (params.subjectId) qs.set("subjectId", params.subjectId);
  const query = qs.toString();
  return handle(await apiFetch(`/internal/bookings${query ? `?${query}` : ""}`));
}

/** Loads every booking in [from, to] by paging (API max limit is 500). */
export async function listBookingsInRange(from: string, to: string): Promise<AdminBookingListItem[]> {
  const all: AdminBookingListItem[] = [];
  let page = 1;
  let total = Infinity;
  while (all.length < total) {
    const res = await searchBookings({ from, to, page, limit: 500 });
    all.push(...res.data);
    total = res.total;
    if (res.data.length === 0) break;
    page += 1;
  }
  return all;
}

export async function getAdminBookingDetail(id: string): Promise<AdminBookingDetail> {
  return handle(await apiFetch(`/internal/bookings/${id}`));
}

export async function overrideCancelBooking(
  id: string,
  reason: string,
): Promise<AdminBookingListItem> {
  return handle(
    await apiFetch(`/internal/bookings/${id}/override-cancel`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  );
}
