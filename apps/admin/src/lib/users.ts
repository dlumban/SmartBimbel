import { apiFetch } from "./api";

export interface AdminUserListItem {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "STUDENT" | "TUTOR" | "ADMIN" | null;
  adminRole: "SUPER_ADMIN" | "SUPPORT" | null;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  bookingCount: number;
  transactionCount: number;
}

export interface PaginatedUsers {
  data: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function searchUsers(
  params: { role?: string; status?: string; q?: string; page?: number } = {},
): Promise<PaginatedUsers> {
  const qs = new URLSearchParams();
  if (params.role) qs.set("role", params.role);
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  const query = qs.toString();
  return handle(await apiFetch(`/internal/users${query ? `?${query}` : ""}`));
}

export async function getUserDetail(id: string): Promise<AdminUserDetail> {
  return handle(await apiFetch(`/internal/users/${id}`));
}

export async function suspendUser(id: string, reason: string): Promise<AdminUserListItem> {
  return handle(
    await apiFetch(`/internal/users/${id}/suspend`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  );
}

export async function reinstateUser(id: string): Promise<AdminUserListItem> {
  return handle(await apiFetch(`/internal/users/${id}/reinstate`, { method: "PATCH" }));
}

export async function setAdminRole(
  id: string,
  adminRole: "SUPER_ADMIN" | "SUPPORT",
): Promise<AdminUserListItem> {
  return handle(
    await apiFetch(`/internal/users/${id}/admin-role`, {
      method: "PATCH",
      body: JSON.stringify({ adminRole }),
    }),
  );
}

// Irreversible - deletes the account plus everything it owns (bookings,
// transactions, messages, reviews, ...). Cascading behavior lives in the
// API's schema; this just calls the endpoint.
export async function deleteUser(id: string): Promise<void> {
  const res = await apiFetch(`/internal/users/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to delete user (${res.status})`);
  }
}

export interface CreateStudentInput {
  name: string;
  phone?: string;
  email?: string;
  gradeLevelId?: string;
  subjectIds?: string[];
  preferredLocation?: string;
  preferredMode?: "ONLINE" | "OFFLINE";
}

// Admin-only onboarding path: creates the Student's account directly, with
// no Firebase sign-up required. If that person later logs in themselves,
// the API claims this same account by phone/email instead of duplicating it.
export async function createStudent(input: CreateStudentInput): Promise<AdminUserListItem> {
  return handle(
    await apiFetch("/internal/users/students", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export interface AccessLink {
  token: string;
  url: string;
}

// Sign-in link for a STUDENT who has no way to log in themselves yet - the
// raw token only ever exists in this response. Stays valid until deactivated.
// Absolute URL is rebuilt from the current browser origin so tunnel/deploy
// hosts stay correct without rewriting WEB_APP_URL every time.
export async function generateAccessLink(id: string): Promise<AccessLink> {
  const link = await handle<AccessLink>(
    await apiFetch(`/internal/users/${id}/access-link`, { method: "POST" }),
  );
  return { ...link, url: `${window.location.origin}/access/${link.token}` };
}

export async function deactivateAccessLink(id: string): Promise<void> {
  const res = await apiFetch(`/internal/users/${id}/access-link`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to deactivate access link (${res.status})`);
  }
}
