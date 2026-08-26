import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StudentFormModal } from "./StudentFormModal";
import { StudentListItem } from "../lib/students";

const getGradeLevels = vi.fn();
const getSubjects = vi.fn();
const createStudent = vi.fn();
const updateStudent = vi.fn();

vi.mock("../lib/masterData", () => ({
  getGradeLevels: () => getGradeLevels(),
  getSubjects: () => getSubjects(),
}));

vi.mock("../lib/students", () => ({
  createStudent: (...args: unknown[]) => createStudent(...args),
  updateStudent: (...args: unknown[]) => updateStudent(...args),
}));

const student: StudentListItem = {
  studentProfileId: "sp1",
  userId: "u1",
  name: "Andi",
  phone: "+6281234567890",
  email: "andi@example.com",
  gradeLevel: { id: "g1", name: "SMA 10-12" },
  subjectsOfInterest: [{ id: "s1", name: "Matematika" }],
  preferredLocation: "Jakarta Selatan",
  preferredMode: "ONLINE",
};

describe("StudentFormModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGradeLevels.mockResolvedValue([{ id: "g1", name: "SMA 10-12" }]);
    getSubjects.mockResolvedValue([
      { id: "s1", name: "Matematika" },
      { id: "s2", name: "Fisika" },
    ]);
  });

  it("renders as an add form with empty fields when no student is given", async () => {
    render(<StudentFormModal open onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByText("Tambah Siswa")).toBeInTheDocument();
    expect(screen.getByLabelText("Nama")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Simpan" })).toBeInTheDocument();
  });

  it("creates a student and calls onSaved", async () => {
    createStudent.mockResolvedValue({ id: "u2" });
    const onSaved = vi.fn();
    render(<StudentFormModal open onClose={vi.fn()} onSaved={onSaved} />);

    await screen.findByText("Tambah Siswa");
    fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Budi" } });
    fireEvent.change(screen.getByLabelText("Telepon"), { target: { value: "081234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(createStudent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Budi", phone: "081234567890" }),
    );
    expect(updateStudent).not.toHaveBeenCalled();
  });

  it("renders as an edit form prefilled from the given student", async () => {
    render(<StudentFormModal open student={student} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByText("Edit Siswa")).toBeInTheDocument();
    expect(screen.getByLabelText("Nama")).toHaveValue("Andi");
    expect(screen.getByLabelText("Telepon")).toHaveValue("+6281234567890");
    expect(screen.getByLabelText("Email")).toHaveValue("andi@example.com");
    expect(screen.getByLabelText("Lokasi")).toHaveValue("Jakarta Selatan");
    expect(screen.getByRole("button", { name: "Simpan Perubahan" })).toBeInTheDocument();
  });

  it("updates a student and calls onSaved", async () => {
    updateStudent.mockResolvedValue({ id: "u1" });
    const onSaved = vi.fn();
    render(<StudentFormModal open student={student} onClose={vi.fn()} onSaved={onSaved} />);

    await screen.findByText("Edit Siswa");
    fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Andi Wijaya" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(updateStudent).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ name: "Andi Wijaya" }),
    );
    expect(createStudent).not.toHaveBeenCalled();
  });

  it("shows an error message when the update fails", async () => {
    updateStudent.mockRejectedValue(new Error("A user with that phone or email already exists."));
    render(<StudentFormModal open student={student} onClose={vi.fn()} onSaved={vi.fn()} />);

    await screen.findByText("Edit Siswa");
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    expect(
      await screen.findByText("A user with that phone or email already exists."),
    ).toBeInTheDocument();
  });
});
