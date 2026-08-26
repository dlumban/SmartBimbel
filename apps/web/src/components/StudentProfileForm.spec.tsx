import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StudentProfileForm } from "./StudentProfileForm";

const getSubjects = vi.fn();
const getGradeLevels = vi.fn();
const createStudentProfile = vi.fn();
const updateName = vi.fn();

vi.mock("../lib/masterData", () => ({
  getSubjects: () => getSubjects(),
  getGradeLevels: () => getGradeLevels(),
}));

vi.mock("../lib/students", () => ({
  createStudentProfile: (...args: unknown[]) => createStudentProfile(...args),
}));

vi.mock("../lib/api", () => ({
  updateName: (...args: unknown[]) => updateName(...args),
}));

describe("StudentProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSubjects.mockResolvedValue([
      { id: "s1", name: "Matematika" },
      { id: "s2", name: "Fisika" },
    ]);
    getGradeLevels.mockResolvedValue([{ id: "g1", name: "SMA 10-12" }]);
    updateName.mockResolvedValue({});
  });

  it("requires a name before submitting", async () => {
    const onSuccess = vi.fn();
    render(<StudentProfileForm onSuccess={onSuccess} />);

    await screen.findByText("Matematika");
    fireEvent.click(screen.getByRole("button", { name: "Simpan profil" }));

    expect(await screen.findByText("Isi nama lengkap Anda.")).toBeInTheDocument();
    expect(createStudentProfile).not.toHaveBeenCalled();
  });

  it("requires a grade level before submitting", async () => {
    const onSuccess = vi.fn();
    render(<StudentProfileForm onSuccess={onSuccess} />);

    await screen.findByText("Matematika");
    fireEvent.change(screen.getByLabelText("Nama lengkap"), {
      target: { value: "Andi" },
    });
    fireEvent.click(screen.getByText("Matematika"));
    fireEvent.click(screen.getByRole("button", { name: "Simpan profil" }));

    expect(await screen.findByText("Pilih jenjang pendidikan.")).toBeInTheDocument();
    expect(createStudentProfile).not.toHaveBeenCalled();
  });

  it("requires at least one subject before submitting", async () => {
    render(<StudentProfileForm onSuccess={vi.fn()} />);

    await screen.findByText("SMA 10-12");
    fireEvent.change(screen.getByLabelText("Nama lengkap"), {
      target: { value: "Andi" },
    });
    fireEvent.change(screen.getByLabelText("Jenjang pendidikan"), {
      target: { value: "g1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan profil" }));

    expect(
      await screen.findByText("Pilih minimal satu mata pelajaran."),
    ).toBeInTheDocument();
  });

  it("submits a valid profile and calls onSuccess", async () => {
    createStudentProfile.mockResolvedValue({ id: "sp1" });
    const onSuccess = vi.fn();
    render(<StudentProfileForm onSuccess={onSuccess} />);

    await screen.findByText("Matematika");
    fireEvent.change(screen.getByLabelText("Nama lengkap"), {
      target: { value: "Andi Nugraha" },
    });
    fireEvent.change(screen.getByLabelText("Jenjang pendidikan"), {
      target: { value: "g1" },
    });
    fireEvent.click(screen.getByText("Matematika"));
    fireEvent.change(screen.getByLabelText("Lokasi (opsional)"), {
      target: { value: "Jakarta Selatan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan profil" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(updateName).toHaveBeenCalledWith("Andi Nugraha");
    expect(createStudentProfile).toHaveBeenCalledWith({
      gradeLevelId: "g1",
      subjectIds: ["s1"],
      preferredLocation: "Jakarta Selatan",
      preferredMode: "ONLINE",
    });
  });

  it("shows an error state when loading options fails", async () => {
    getSubjects.mockRejectedValue(new Error("network error"));
    render(<StudentProfileForm onSuccess={vi.fn()} />);

    expect(
      await screen.findByText("Gagal memuat data mata pelajaran/jenjang."),
    ).toBeInTheDocument();
  });
});
