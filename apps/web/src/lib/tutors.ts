import { apiFetch } from "./api";

export interface TutorProfile {
  id: string;
  bio: string | null;
  education: string | null;
  hourlyRate: number | null;
  teachingModes: ("ONLINE" | "OFFLINE")[];
  city: string | null;
  ktpDocumentPath: string | null;
  diplomaDocumentPath: string | null;
  profileSubmittedAt: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionReason: string | null;
  subjects: { id: string; name: string }[];
  gradeLevels: { id: string; name: string }[];
}

/** Returns null (not an error) when the tutor hasn't started the form yet. */
export async function getMyTutorProfile(): Promise<TutorProfile | null> {
  const res = await apiFetch("/tutors/me");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load tutor profile (${res.status})`);
  return res.json();
}

export interface UpsertTutorProfileInput {
  bio?: string;
  education?: string;
  hourlyRate?: number;
  teachingModes?: ("ONLINE" | "OFFLINE")[];
  city?: string;
  subjectIds?: string[];
  gradeLevelIds?: string[];
}

export async function upsertTutorProfile(input: UpsertTutorProfileInput) {
  const res = await apiFetch("/tutors/profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to save tutor profile (${res.status})`);
  }
  return res.json();
}

export async function uploadTutorDocument(
  type: "ktp" | "diploma",
  file: File,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiFetch(`/tutors/me/documents/${type}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload ${type} document (${res.status})`);
  }
}

export async function submitTutorProfileForReview() {
  const res = await apiFetch("/tutors/profile/submit", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to submit profile (${res.status})`);
  }
  return res.json();
}
