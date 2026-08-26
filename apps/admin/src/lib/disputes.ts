import { apiFetch } from "./api";

export interface AdminDispute {
  id: string;
  bookingId: string;
  reason: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED_REFUND" | "RESOLVED_NO_REFUND";
  resolutionNotes: string | null;
  createdAt: string;
  booking: {
    id: string;
    status: string;
    noShowReported: boolean;
    student: { user: { name: string | null } };
    tutor: { user: { name: string | null } };
    transaction: { status: string; amount: number } | null;
  };
}

export interface MessageReportItem {
  id: string;
  reason: string;
  createdAt: string;
  reporter: { id: string; name: string | null };
  reportedUser: { id: string; name: string | null };
  message: { id: string; body: string } | null;
  conversation: { bookingId: string };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function listOpenDisputes(): Promise<AdminDispute[]> {
  return handle(await apiFetch("/internal/disputes"));
}

export async function resolveDispute(
  id: string,
  input: { status: "RESOLVED_REFUND" | "RESOLVED_NO_REFUND"; resolutionNotes?: string; refundAmount?: number },
): Promise<AdminDispute> {
  return handle(
    await apiFetch(`/internal/disputes/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function listReports(): Promise<MessageReportItem[]> {
  return handle(await apiFetch("/internal/reports"));
}
