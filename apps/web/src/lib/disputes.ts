import { apiFetch } from "./api";

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED_REFUND" | "RESOLVED_NO_REFUND";

export interface Dispute {
  id: string;
  bookingId: string;
  raisedByUserId: string | null;
  reason: string;
  status: DisputeStatus;
  resolutionNotes: string | null;
  createdAt: string;
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: "Menunggu peninjauan",
  UNDER_REVIEW: "Sedang ditinjau",
  RESOLVED_REFUND: "Selesai - dana dikembalikan",
  RESOLVED_NO_REFUND: "Selesai - tanpa pengembalian dana",
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function raiseDispute(bookingId: string, reason: string): Promise<Dispute> {
  return handle(
    await apiFetch(`/bookings/${bookingId}/disputes`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  );
}

export async function listDisputes(bookingId: string): Promise<Dispute[]> {
  return handle(await apiFetch(`/bookings/${bookingId}/disputes`));
}
