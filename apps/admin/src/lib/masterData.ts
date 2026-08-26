const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export interface Subject {
  id: string;
  name: string;
}

export interface GradeLevel {
  id: string;
  name: string;
}

export async function getSubjects(): Promise<Subject[]> {
  const res = await fetch(`${API_URL}/subjects`);
  if (!res.ok) throw new Error(`Failed to load subjects (${res.status})`);
  return res.json();
}

export async function getGradeLevels(): Promise<GradeLevel[]> {
  const res = await fetch(`${API_URL}/grade-levels`);
  if (!res.ok) throw new Error(`Failed to load grade levels (${res.status})`);
  return res.json();
}
