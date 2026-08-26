import { firebaseAuth } from "./firebase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export interface SessionUser {
  id: string;
  name: string | null;
  role: "STUDENT" | "TUTOR" | "ADMIN" | null;
  adminRole: "SUPER_ADMIN" | "SUPPORT" | null;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "SUSPENDED";
  hasProfile: boolean;
}

// Reuses Sprint 1's session-exchange endpoint (Task 7.1's own scope:
// "reuses Sprint 1's auth") - the only difference from apps/web's login is
// what happens *after* exchange (useAuth below rejects anyone who isn't
// role: "ADMIN").
export async function exchangeSession(idToken: string): Promise<SessionUser> {
  const res = await fetch(`${API_URL}/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    throw new Error(`Session exchange failed with status ${res.status}`);
  }

  return res.json();
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = await firebaseAuth?.currentUser?.getIdToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }

  return res;
}
