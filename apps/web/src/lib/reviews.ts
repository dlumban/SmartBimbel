import { apiFetch } from "./api";

export interface Review {
  id: string;
  bookingId: string;
  rating: number;
  text: string | null;
  flagged: boolean;
  createdAt: string;
  updatedAt: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function submitReview(
  bookingId: string,
  input: { rating: number; text?: string },
): Promise<Review> {
  return handle(
    await apiFetch(`/bookings/${bookingId}/review`, { method: "POST", body: JSON.stringify(input) }),
  );
}

export async function getReview(bookingId: string): Promise<Review | null> {
  return handle(await apiFetch(`/bookings/${bookingId}/review`));
}
