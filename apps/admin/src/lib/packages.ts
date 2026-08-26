import { apiFetch } from "./api";

export interface TutoringPackage {
  id: string;
  name: string;
  sessionCount: number;
  durationMinutes: number;
  totalPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function listPackages(): Promise<TutoringPackage[]> {
  return handle(await apiFetch("/internal/packages"));
}

export interface PackageInput {
  name: string;
  sessionCount: number;
  durationMinutes: number;
  totalPrice: number;
}

export async function createPackage(input: PackageInput): Promise<TutoringPackage> {
  return handle(await apiFetch("/internal/packages", { method: "POST", body: JSON.stringify(input) }));
}

export async function updatePackage(
  id: string,
  input: Partial<PackageInput>,
): Promise<TutoringPackage> {
  return handle(
    await apiFetch(`/internal/packages/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  );
}

export async function setPackageActive(id: string, isActive: boolean): Promise<TutoringPackage> {
  return handle(
    await apiFetch(`/internal/packages/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),
  );
}
