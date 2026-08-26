import { apiFetch } from "./api";

export interface AdminPayout {
  id: string;
  amount: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolderName: string | null;
  failureReason: string | null;
  createdAt: string;
  tutor: { user: { name: string | null; email: string | null } };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function listPendingPayouts(): Promise<AdminPayout[]> {
  return handle(await apiFetch("/internal/payouts/pending"));
}

export async function updatePayoutStatus(
  id: string,
  input: { status: "PROCESSING" | "COMPLETED" | "FAILED"; failureReason?: string },
): Promise<AdminPayout> {
  return handle(
    await apiFetch(`/internal/payouts/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}
