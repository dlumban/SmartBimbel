import { apiFetch } from "./api";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export interface SessionTokenResponse {
  roomUrl: string;
  roomName: string;
  token: string;
  canEditWhiteboard: boolean;
  dailyConfigured: boolean;
}

export async function getSessionToken(bookingId: string): Promise<SessionTokenResponse> {
  return handle(await apiFetch(`/bookings/${bookingId}/session-token`));
}

export async function getWhiteboard(bookingId: string): Promise<{ snapshot: unknown | null }> {
  return handle(await apiFetch(`/bookings/${bookingId}/whiteboard`));
}

export async function saveWhiteboard(bookingId: string, snapshot: unknown): Promise<void> {
  await handle(
    await apiFetch(`/bookings/${bookingId}/whiteboard`, {
      method: "PUT",
      body: JSON.stringify({ snapshot }),
    }),
  );
}
