import { apiFetch } from "./api";

export interface StudentProfile {
  id: string;
  gradeLevel: { id: string; name: string } | null;
  subjectsOfInterest: { id: string; name: string }[];
  preferredLocation: string | null;
  preferredMode: "ONLINE" | "OFFLINE" | null;
}

export interface UpsertStudentProfileInput {
  gradeLevelId: string;
  subjectIds: string[];
  preferredLocation?: string;
  preferredMode?: "ONLINE" | "OFFLINE";
}

export async function createStudentProfile(
  input: UpsertStudentProfileInput,
): Promise<StudentProfile> {
  const res = await apiFetch("/students/profile", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to save student profile (${res.status})`);
  }
  return res.json();
}

export interface StudentListItem {
  studentProfileId: string;
  userId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  gradeLevel: { id: string; name: string } | null;
  subjectsOfInterest: { id: string; name: string }[];
  preferredLocation: string | null;
  preferredMode: "ONLINE" | "OFFLINE" | null;
}

export interface PaginatedStudents {
  data: StudentListItem[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Tutor-only: paginated, name/phone/email-filterable listing of bookable
 * students. By default returns the platform-wide pool plus this tutor's own
 * added students; pass `mine: true` to see only students this tutor added.
 */
export async function listStudents(
  params: { q?: string; page?: number; limit?: number; mine?: boolean } = {},
): Promise<PaginatedStudents> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.mine) qs.set("mine", "true");
  const query = qs.toString();
  const res = await apiFetch(`/students${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error(`Failed to load students (${res.status})`);
  return res.json();
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

export interface CreatedStudent {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

// Tutor-only onboarding path (an offline referral/walk-in) - creates the
// student's account directly, with no Firebase sign-up required, private to
// this tutor. If that person later logs in themselves, the API claims this
// same account by phone/email instead of duplicating it.
export async function createStudent(input: CreateStudentInput): Promise<CreatedStudent> {
  const res = await apiFetch("/students", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to create student (${res.status})`);
  }
  return res.json();
}

export type UpdateStudentInput = Partial<CreateStudentInput>;

// Tutor-only: edits a student they added themselves. The API rejects this
// for any student the calling tutor didn't add.
export async function updateStudent(
  userId: string,
  input: UpdateStudentInput,
): Promise<CreatedStudent> {
  const res = await apiFetch(`/students/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to update student (${res.status})`);
  }
  return res.json();
}

export interface AccessLink {
  token: string;
  url: string;
}

// Sign-in link for a student the tutor added who has no way to log in
// themselves yet. Stays valid until deactivated. Absolute URL is rebuilt
// from the current browser origin so tunnel/deploy hosts stay correct.
export async function generateStudentAccessLink(userId: string): Promise<AccessLink> {
  const res = await apiFetch(`/students/${userId}/access-link`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to generate access link (${res.status})`);
  }
  const link = (await res.json()) as AccessLink;
  return { ...link, url: `${window.location.origin}/access/${link.token}` };
}

export async function deactivateStudentAccessLink(userId: string): Promise<void> {
  const res = await apiFetch(`/students/${userId}/access-link`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to deactivate access link (${res.status})`);
  }
}
