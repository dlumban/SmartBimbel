import { apiFetch } from "./api";

export interface PendingTutor {
  id: string;
  bio: string | null;
  education: string | null;
  hourlyRate: number | null;
  city: string | null;
  teachingModes: ("ONLINE" | "OFFLINE")[];
  ktpDocumentPath: string | null;
  diplomaDocumentPath: string | null;
  profileSubmittedAt: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  subjects: { id: string; name: string }[];
  gradeLevels: { id: string; name: string }[];
  user: { id: string; name: string | null; email: string | null; phone: string | null };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function listPendingTutors(): Promise<PendingTutor[]> {
  return handle(await apiFetch("/internal/tutors/pending"));
}

export async function verifyTutor(
  id: string,
  input: { status: "VERIFIED" | "REJECTED"; reason?: string },
): Promise<PendingTutor> {
  return handle(
    await apiFetch(`/internal/tutors/${id}/verification`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

// The document route needs the same auth header as everything else, so it
// can't be a plain <a href>/<img src> - fetch it as a blob and hand back
// an object URL the caller can point an <img>/<a> at, then revoke.
export async function getTutorDocumentUrl(id: string, type: "ktp" | "diploma"): Promise<string> {
  const res = await apiFetch(`/internal/tutors/${id}/documents/${type}`);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
