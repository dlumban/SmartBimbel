import { apiFetch } from "./api";

export interface AnalyticsSummary {
  registeredTutors: number;
  registeredStudents: number;
  completedBookings: number;
  bookingConversionRate: number;
  gmv: number;
  platformTake: number;
  averageSessionRating: number | null;
  ratingCount: number;
  tutorActivationRate: number;
  studentSecondBookingRate: number;
}

export interface CityBreakdownEntry {
  city: string;
  bookingCount: number;
  gmv: number;
  platformTake: number;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function getAnalyticsSummary(range: { from?: string; to?: string } = {}): Promise<AnalyticsSummary> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  const query = qs.toString();
  return handle(await apiFetch(`/internal/analytics/summary${query ? `?${query}` : ""}`));
}

export async function getCityBreakdown(
  range: { from?: string; to?: string } = {},
): Promise<CityBreakdownEntry[]> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  const query = qs.toString();
  return handle(await apiFetch(`/internal/analytics/cities${query ? `?${query}` : ""}`));
}
