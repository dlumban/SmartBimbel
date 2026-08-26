import { apiFetch } from "./api";

export interface AdminTransaction {
  id: string;
  amount: number;
  commission: number;
  gatewayRef: string | null;
  refundedAmount: number | null;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  paidAt: string | null;
  createdAt: string;
  booking: {
    id: string;
    subject: { name: string };
    student: { user: { name: string | null } };
    tutor: { user: { name: string | null } };
  };
}

export interface PaginatedTransactions {
  data: AdminTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface ReconciliationResult {
  data: AdminTransaction[];
  total: number;
  staleThresholdHours: number;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function listAdminTransactions(
  params: { status?: string; page?: number } = {},
): Promise<PaginatedTransactions> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  const query = qs.toString();
  return handle(await apiFetch(`/internal/transactions${query ? `?${query}` : ""}`));
}

export async function getReconciliation(): Promise<ReconciliationResult> {
  return handle(await apiFetch("/internal/transactions/reconciliation"));
}
