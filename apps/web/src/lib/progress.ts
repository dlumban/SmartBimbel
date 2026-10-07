import { apiFetch } from "./api";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface ProgressReport {
  id: string;
  bookingId: string;
  topicsCovered: string;
  strengths: string | null;
  areasToImprove: string | null;
  nextGoals: string | null;
  overallScore: number | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type HomeworkStatus = "ASSIGNED" | "SUBMITTED" | "REVIEWED";

export interface HomeworkSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string | null;
  submittedAt: string;
  tutorFeedback: string | null;
  reviewedAt: string | null;
  student?: { user: { name: string | null } };
}

export interface HomeworkAssignment {
  id: string;
  bookingId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: HomeworkStatus;
  createdAt: string;
  submissions: HomeworkSubmission[];
}

export async function getProgressReport(bookingId: string): Promise<ProgressReport | null> {
  const res = await apiFetch(`/bookings/${bookingId}/progress-report`);
  if (res.status === 404) return null;
  return handle(res);
}

export async function upsertProgressReport(
  bookingId: string,
  input: {
    topicsCovered: string;
    strengths?: string;
    areasToImprove?: string;
    nextGoals?: string;
    overallScore?: number;
  },
): Promise<ProgressReport> {
  return handle(
    await apiFetch(`/bookings/${bookingId}/progress-report`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  );
}

export async function listHomework(bookingId: string): Promise<HomeworkAssignment[]> {
  return handle(await apiFetch(`/bookings/${bookingId}/homework`));
}

export async function createHomework(
  bookingId: string,
  input: { title: string; description?: string; dueAt?: string },
): Promise<HomeworkAssignment> {
  return handle(
    await apiFetch(`/bookings/${bookingId}/homework`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function submitHomework(
  assignmentId: string,
  content: string,
): Promise<HomeworkSubmission> {
  return handle(
    await apiFetch(`/homework/${assignmentId}/submit`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  );
}

export async function reviewHomework(
  assignmentId: string,
  tutorFeedback?: string,
): Promise<HomeworkAssignment> {
  return handle(
    await apiFetch(`/homework/${assignmentId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ tutorFeedback }),
    }),
  );
}
