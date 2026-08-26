import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TutorProfileWizard } from "./TutorProfileWizard";

const getSubjects = vi.fn();
const getGradeLevels = vi.fn();
const getMyTutorProfile = vi.fn();
const upsertTutorProfile = vi.fn();
const uploadTutorDocument = vi.fn();
const submitTutorProfileForReview = vi.fn();
const updateName = vi.fn();

vi.mock("../lib/masterData", () => ({
  getSubjects: () => getSubjects(),
  getGradeLevels: () => getGradeLevels(),
}));

vi.mock("../lib/tutors", () => ({
  getMyTutorProfile: () => getMyTutorProfile(),
  upsertTutorProfile: (...args: unknown[]) => upsertTutorProfile(...args),
  uploadTutorDocument: (...args: unknown[]) => uploadTutorDocument(...args),
  submitTutorProfileForReview: () => submitTutorProfileForReview(),
}));

vi.mock("../lib/api", () => ({
  updateName: (...args: unknown[]) => updateName(...args),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ sessionUser: { name: null } }),
}));

describe("TutorProfileWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSubjects.mockResolvedValue([{ id: "s1", name: "Matematika" }]);
    getGradeLevels.mockResolvedValue([{ id: "g1", name: "SMA 10-12" }]);
    getMyTutorProfile.mockResolvedValue(null);
    updateName.mockResolvedValue({});
  });

  it("starts at step 1 for a brand-new tutor", async () => {
    render(<TutorProfileWizard onSubmitted={vi.fn()} />);
    expect(await screen.findByText("Langkah 1 dari 4")).toBeInTheDocument();
    expect(screen.getByLabelText("Bio singkat")).toBeInTheDocument();
  });

  it("resumes at step 3 when bio/education/subjects are already filled in", async () => {
    getMyTutorProfile.mockResolvedValue({
      id: "tp1",
      bio: "hi",
      education: "S1",
      hourlyRate: null,
      teachingModes: [],
      city: null,
      ktpDocumentPath: null,
      diplomaDocumentPath: null,
      profileSubmittedAt: null,
      subjects: [{ id: "s1", name: "Matematika" }],
      gradeLevels: [{ id: "g1", name: "SMA 10-12" }],
    });

    render(<TutorProfileWizard onSubmitted={vi.fn()} />);
    expect(await screen.findByText("Langkah 3 dari 4")).toBeInTheDocument();
  });

  it("blocks advancing past step 1 until name, bio, and education are filled in", async () => {
    render(<TutorProfileWizard onSubmitted={vi.fn()} />);
    await screen.findByText("Langkah 1 dari 4");

    fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));

    expect(
      await screen.findByText("Isi nama, bio, dan pendidikan Anda."),
    ).toBeInTheDocument();
    expect(upsertTutorProfile).not.toHaveBeenCalled();
  });

  it("saves step 1 (name + profile) and advances to step 2", async () => {
    upsertTutorProfile.mockResolvedValue({});
    render(<TutorProfileWizard onSubmitted={vi.fn()} />);
    await screen.findByText("Langkah 1 dari 4");

    fireEvent.change(screen.getByLabelText("Nama lengkap"), {
      target: { value: "Budi Santoso" },
    });
    fireEvent.change(screen.getByLabelText("Bio singkat"), {
      target: { value: "Pengajar berpengalaman" },
    });
    fireEvent.change(screen.getByLabelText("Latar belakang pendidikan"), {
      target: { value: "S1 Matematika" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));

    await waitFor(() => expect(screen.getByText("Langkah 2 dari 4")).toBeInTheDocument());
    expect(updateName).toHaveBeenCalledWith("Budi Santoso");
    expect(upsertTutorProfile).toHaveBeenCalledWith({
      bio: "Pengajar berpengalaman",
      education: "S1 Matematika",
    });
  });

  it("requires a KTP file before final submission", async () => {
    getMyTutorProfile.mockResolvedValue({
      id: "tp1",
      bio: "hi",
      education: "S1",
      hourlyRate: 150000,
      teachingModes: ["ONLINE"],
      city: "Jakarta",
      ktpDocumentPath: null,
      diplomaDocumentPath: null,
      profileSubmittedAt: null,
      subjects: [{ id: "s1", name: "Matematika" }],
      gradeLevels: [{ id: "g1", name: "SMA 10-12" }],
    });

    render(<TutorProfileWizard onSubmitted={vi.fn()} />);
    await screen.findByText("Langkah 4 dari 4");

    fireEvent.click(screen.getByRole("button", { name: "Kirim untuk verifikasi" }));

    expect(
      await screen.findByText("Unggah foto KTP untuk verifikasi."),
    ).toBeInTheDocument();
    expect(submitTutorProfileForReview).not.toHaveBeenCalled();
  });

  it("lets an already-verified tutor edit their profile, including adding subjects", async () => {
    getSubjects.mockResolvedValue([
      { id: "s1", name: "Matematika" },
      { id: "s2", name: "Bahasa Indonesia" },
    ]);
    getMyTutorProfile.mockResolvedValue({
      id: "tp1",
      bio: "hi",
      education: "S1",
      hourlyRate: 150000,
      teachingModes: ["ONLINE"],
      city: "Jakarta",
      ktpDocumentPath: "x",
      diplomaDocumentPath: null,
      profileSubmittedAt: "2026-01-01T00:00:00.000Z",
      verificationStatus: "VERIFIED",
      rejectionReason: null,
      subjects: [{ id: "s1", name: "Matematika" }],
      gradeLevels: [{ id: "g1", name: "SMA 10-12" }],
    });
    upsertTutorProfile.mockResolvedValue({});

    render(<TutorProfileWizard onSubmitted={vi.fn()} />);

    expect(await screen.findByText(/Profil Anda sudah terverifikasi/)).toBeInTheDocument();
    expect(screen.queryByText("Langkah 4 dari 4")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nama lengkap"), {
      target: { value: "Budi Santoso" },
    });
    // Not yet selected - the tutor can add it.
    fireEvent.click(screen.getByRole("button", { name: "Bahasa Indonesia" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() =>
      expect(upsertTutorProfile).toHaveBeenCalledWith(
        expect.objectContaining({ subjectIds: ["s1", "s2"] }),
      ),
    );
    expect(await screen.findByText("Perubahan disimpan.")).toBeInTheDocument();
  });

  it("validates required fields before saving an already-verified tutor's edits", async () => {
    getMyTutorProfile.mockResolvedValue({
      id: "tp1",
      bio: "hi",
      education: "S1",
      hourlyRate: 150000,
      teachingModes: ["ONLINE"],
      city: "Jakarta",
      ktpDocumentPath: "x",
      diplomaDocumentPath: null,
      profileSubmittedAt: "2026-01-01T00:00:00.000Z",
      verificationStatus: "VERIFIED",
      rejectionReason: null,
      subjects: [{ id: "s1", name: "Matematika" }],
      gradeLevels: [{ id: "g1", name: "SMA 10-12" }],
    });

    render(<TutorProfileWizard onSubmitted={vi.fn()} />);
    await screen.findByText("Simpan Perubahan");

    fireEvent.change(screen.getByLabelText("Nama lengkap"), {
      target: { value: "Budi Santoso" },
    });
    // Deselecting the only subject should block saving.
    fireEvent.click(screen.getByRole("button", { name: "Matematika" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    expect(
      await screen.findByText("Pilih minimal satu mata pelajaran dan jenjang."),
    ).toBeInTheDocument();
    expect(upsertTutorProfile).not.toHaveBeenCalled();
  });

  it("shows the rejection reason and lets the tutor resubmit", async () => {
    getMyTutorProfile.mockResolvedValue({
      id: "tp1",
      bio: "hi",
      education: "S1",
      hourlyRate: 150000,
      teachingModes: ["ONLINE"],
      city: "Jakarta",
      ktpDocumentPath: "x",
      diplomaDocumentPath: null,
      profileSubmittedAt: "2026-01-01T00:00:00.000Z",
      verificationStatus: "REJECTED",
      rejectionReason: "Foto KTP buram",
      subjects: [{ id: "s1", name: "Matematika" }],
      gradeLevels: [{ id: "g1", name: "SMA 10-12" }],
    });

    render(<TutorProfileWizard onSubmitted={vi.fn()} />);

    expect(await screen.findByText("Foto KTP buram")).toBeInTheDocument();
    expect(screen.getByText("Langkah 4 dari 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kirim untuk verifikasi" })).toBeInTheDocument();
  });

  it("uploads the KTP and submits when everything is complete", async () => {
    getMyTutorProfile.mockResolvedValue({
      id: "tp1",
      bio: "hi",
      education: "S1",
      hourlyRate: 150000,
      teachingModes: ["ONLINE"],
      city: "Jakarta",
      ktpDocumentPath: null,
      diplomaDocumentPath: null,
      profileSubmittedAt: null,
      subjects: [{ id: "s1", name: "Matematika" }],
      gradeLevels: [{ id: "g1", name: "SMA 10-12" }],
    });
    uploadTutorDocument.mockResolvedValue(undefined);
    submitTutorProfileForReview.mockResolvedValue({});
    const onSubmitted = vi.fn();

    render(<TutorProfileWizard onSubmitted={onSubmitted} />);
    await screen.findByText("Langkah 4 dari 4");

    const file = new File(["fake"], "ktp.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Foto KTP (wajib)"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim untuk verifikasi" }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
    expect(uploadTutorDocument).toHaveBeenCalledWith("ktp", file);
    expect(submitTutorProfileForReview).toHaveBeenCalledOnce();
  });
});
