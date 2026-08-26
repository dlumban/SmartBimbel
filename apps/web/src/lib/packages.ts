import { AllowedBookingDurationMinutes } from "@smartbimbel/shared";
import { apiFetch } from "./api";

// Admin-managed fixed-price bundle a tutor can pick when scheduling a
// session - overrides normal hourly-rate pricing for that booking (see
// BookingsService.create's packageId branch).
export interface TutoringPackage {
  id: string;
  name: string;
  sessionCount: number;
  durationMinutes: AllowedBookingDurationMinutes;
  totalPrice: number;
  isActive: boolean;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function listActivePackages(): Promise<TutoringPackage[]> {
  return handle(await apiFetch("/packages"));
}
