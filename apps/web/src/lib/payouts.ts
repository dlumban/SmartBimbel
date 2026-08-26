import { apiFetch } from "./api";

export type PayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface Payout {
  id: string;
  amount: number;
  status: PayoutStatus;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolderName: string | null;
  failureReason: string | null;
  processedAt: string | null;
  createdAt: string;
}

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  PENDING: "Menunggu diproses",
  PROCESSING: "Sedang diproses",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
};

interface TutorProfile {
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolderName: string | null;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function setBankDetails(input: {
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolderName: string;
}): Promise<TutorProfile> {
  return handle(
    await apiFetch("/tutors/me/bank-details", { method: "PATCH", body: JSON.stringify(input) }),
  );
}

export async function requestPayout(amount: number): Promise<Payout> {
  return handle(await apiFetch("/payouts/request", { method: "POST", body: JSON.stringify({ amount }) }));
}

export async function listMyPayouts(): Promise<Payout[]> {
  return handle(await apiFetch("/payouts"));
}
