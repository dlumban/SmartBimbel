import { apiFetch } from "./api";
import { Payout } from "./payouts";

export interface EarningsSummary {
  totalEarned: number;
  availableBalance: number;
  pendingBalance: number;
  payouts: Payout[];
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function getEarningsSummary(): Promise<EarningsSummary> {
  return handle(await apiFetch("/tutors/me/earnings"));
}

// The export endpoint needs the same auth header as everything else
// (apiFetch attaches it), so it can't be a plain <a href> - fetch it as
// text and trigger the browser download ourselves.
export async function downloadEarningsCsv(range: { from?: string; to?: string } = {}): Promise<void> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  const query = qs.toString();
  const res = await apiFetch(`/tutors/me/earnings/export${query ? `?${query}` : ""}`);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  const csv = await res.text();
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "earnings.csv";
  link.click();
  URL.revokeObjectURL(url);
}
