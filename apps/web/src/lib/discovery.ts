import {
  PaginatedTutorList,
  PaginatedTutorReviews,
  TutorDetail,
  TutorScheduleBlock,
} from "@smartbimbel/shared";

export type {
  PaginatedTutorList,
  TutorDetail,
  TutorListItem,
  TutorScheduleBlock,
  PaginatedTutorReviews,
  TutorReview,
} from "@smartbimbel/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export interface SearchTutorsParams {
  subjectId?: string;
  gradeLevelId?: string;
  city?: string;
  mode?: "ONLINE" | "OFFLINE";
  priceMin?: number;
  priceMax?: number;
  q?: string;
  sort?: "rating" | "price" | "nearest";
  near?: string;
  page?: number;
  limit?: number;
}

export async function searchTutors(params: SearchTutorsParams): Promise<PaginatedTutorList> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }

  const res = await fetch(`${API_URL}/tutors?${search.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to search tutors (${res.status})`);
  }
  return res.json();
}

export async function getTutorDetail(id: string): Promise<TutorDetail> {
  const res = await fetch(`${API_URL}/tutors/${id}`);
  if (res.status === 404) {
    throw new Error("NOT_FOUND");
  }
  if (!res.ok) {
    throw new Error(`Failed to load tutor (${res.status})`);
  }
  return res.json();
}

export async function getTutorSchedule(id: string): Promise<TutorScheduleBlock[]> {
  const res = await fetch(`${API_URL}/tutors/${id}/schedule`);
  if (res.status === 404) {
    throw new Error("NOT_FOUND");
  }
  if (!res.ok) {
    throw new Error(`Failed to load tutor schedule (${res.status})`);
  }
  return res.json();
}

export async function getTutorReviews(
  id: string,
  page = 1,
  limit = 10,
): Promise<PaginatedTutorReviews> {
  const res = await fetch(`${API_URL}/tutors/${id}/reviews?page=${page}&limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to load reviews (${res.status})`);
  }
  return res.json();
}
