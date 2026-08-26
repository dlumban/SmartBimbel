import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StudentPickerTable } from "./StudentPickerTable";

const listStudents = vi.fn();
vi.mock("../lib/students", () => ({
  listStudents: (...args: unknown[]) => listStudents(...args),
}));

function makeStudent(overrides: Record<string, unknown> = {}) {
  return {
    studentProfileId: "sp1",
    userId: "student-1",
    name: "Andi Nugraha",
    phone: "+6281234567890",
    email: "andi@example.com",
    ...overrides,
  };
}

describe("StudentPickerTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists students and calls onSelect with the picked row", async () => {
    listStudents.mockResolvedValue({ data: [makeStudent()], total: 1, page: 1, limit: 10 });
    const onSelect = vi.fn();
    render(<StudentPickerTable onSelect={onSelect} />);

    expect(await screen.findByText("Andi Nugraha")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pilih" }));

    expect(onSelect).toHaveBeenCalledWith(makeStudent());
  });

  it("shows an empty-results message when nothing matches", async () => {
    listStudents.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });
    render(<StudentPickerTable onSelect={vi.fn()} />);

    expect(await screen.findByText("Tidak ada siswa yang cocok.")).toBeInTheDocument();
  });

  it("re-fetches with q and resets to page 1 on search", async () => {
    listStudents.mockResolvedValue({ data: [makeStudent()], total: 1, page: 1, limit: 10 });
    render(<StudentPickerTable onSelect={vi.fn()} />);
    await screen.findByText("Andi Nugraha");

    fireEvent.change(screen.getByLabelText("Cari siswa"), { target: { value: "andi" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));

    await waitFor(() =>
      expect(listStudents).toHaveBeenLastCalledWith({ q: "andi", page: 1, limit: 10 }),
    );
  });

  it("shows pagination controls and pages forward", async () => {
    listStudents.mockResolvedValue({
      data: [makeStudent()],
      total: 25,
      page: 1,
      limit: 10,
    });
    render(<StudentPickerTable onSelect={vi.fn()} />);
    await screen.findByText("Andi Nugraha");

    expect(screen.getByText("Halaman 1 dari 3")).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Berikutnya" });
    expect(next).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Sebelumnya" })).toBeDisabled();

    fireEvent.click(next);

    await waitFor(() =>
      expect(listStudents).toHaveBeenLastCalledWith({ q: undefined, page: 2, limit: 10 }),
    );
  });

  it("shows an error state and retries on failure", async () => {
    listStudents.mockRejectedValueOnce(new Error("boom"));
    listStudents.mockResolvedValueOnce({ data: [makeStudent()], total: 1, page: 1, limit: 10 });
    render(<StudentPickerTable onSelect={vi.fn()} />);

    expect(await screen.findByText("Gagal memuat daftar siswa.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    expect(await screen.findByText("Andi Nugraha")).toBeInTheDocument();
  });
});
