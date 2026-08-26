import { firebaseAuth } from "./firebase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export interface SessionUser {
  id: string;
  name: string | null;
  role: "STUDENT" | "TUTOR" | "ADMIN" | null;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "SUSPENDED";
  hasProfile: boolean;
}

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

// Redeems an admin-generated access link (public - the whole point is the
// caller has no session yet) for a Firebase custom token, which the caller
// then signs in with via signInWithCustomToken. Single-use: this call is
// what burns the link server-side, whether or not the sign-in that follows
// actually succeeds.
export async function redeemAccessLink(token: string): Promise<{ customToken: string }> {
  const res = await fetch(`${API_URL}/auth/access-link/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Redeeming the access link failed (${res.status})`);
  }
  return res.json();
}

export async function updateName(name: string): Promise<SessionUser> {
  const res = await apiFetch("/users/me", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`Updating name failed with status ${res.status}`);
  }
  return res.json();
}

export async function setRole(role: "STUDENT" | "TUTOR"): Promise<SessionUser> {
  const res = await apiFetch("/users/me/role", {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    throw new Error(`Setting role failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * fetch() wrapper for every authenticated API call: attaches the current
 * Firebase user's ID token as a Bearer header (the SDK transparently
 * refreshes it before expiry - getIdToken() returns a valid token as long
 * as the underlying Firebase session is still valid, no manual refresh
 * logic needed here) and redirects to /login on a 401 response.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = await firebaseAuth?.currentUser?.getIdToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  // FormData needs the browser to set its own Content-Type (with the
  // multipart boundary) - forcing application/json here would break file
  // uploads (see uploadTutorDocument in lib/tutors.ts).
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }

  return res;
}
