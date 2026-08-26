import { apiFetch } from "./api";

export interface ChatToken {
  token: string;
  apiKey: string | null;
  channelId: string | null;
}

export interface ChatMessage {
  id: string;
  body: string;
  senderId: string;
  sender: { id: string; name: string | null };
  createdAt: string;
}

export interface PaginatedMessages {
  data: ChatMessage[];
  total: number;
  page: number;
  limit: number;
}

// Distinguishes "Stream isn't configured on this server yet" (a real,
// expected state in this environment - see StreamChatService) from other
// failures, so the UI can show a clear "not available yet" message rather
// than a generic error.
export class ChatUnavailableError extends Error {
  constructor() {
    super("Chat is not configured on this server yet.");
    this.name = "ChatUnavailableError";
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 503) {
    throw new ChatUnavailableError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function getChatToken(bookingId: string): Promise<ChatToken> {
  return handle(await apiFetch(`/bookings/${bookingId}/chat/token`));
}

export async function listMessages(
  bookingId: string,
  page = 1,
  limit = 50,
): Promise<PaginatedMessages> {
  return handle(await apiFetch(`/bookings/${bookingId}/messages?page=${page}&limit=${limit}`));
}

export async function sendMessage(bookingId: string, body: string): Promise<ChatMessage> {
  return handle(
    await apiFetch(`/bookings/${bookingId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  );
}

export async function reportMessage(
  bookingId: string,
  messageId: string,
  reason: string,
): Promise<void> {
  await handle(
    await apiFetch(`/bookings/${bookingId}/messages/${messageId}/report`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  );
}

export async function reportUser(bookingId: string, reason: string): Promise<void> {
  await handle(
    await apiFetch(`/bookings/${bookingId}/report`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  );
}

export async function blockUser(bookingId: string): Promise<void> {
  await handle(await apiFetch(`/bookings/${bookingId}/block`, { method: "POST" }));
}
