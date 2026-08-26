import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TutorApprovalQueue } from "./TutorApprovalQueue";

const listPendingTutors = vi.fn();
const verifyTutor = vi.fn();
const getTutorDocumentUrl = vi.fn();
vi.mock("../lib/tutors", async () => {
  const actual = await vi.importActual<typeof import("../lib/tutors")>("../lib/tutors");
  return {
    ...actual,
    listPendingTutors: (...args: unknown[]) => listPendingTutors(...args),
    verifyTutor: (...args: unknown[]) => verifyTutor(...args),
    getTutorDocumentUrl: (...args: unknown[]) => getTutorDocumentUrl(...args),
  };
});

function makeTutor(overrides: Record<string, unknown> = {}) {
  return {
    id: "tp1",
    bio: "Pengajar berpengalaman",
    education: "S1 Fisika",
    hourlyRate: 100000,
    city: "Jakarta",
    teachingModes: ["ONLINE"],
    ktpDocumentPath: "tutor-documents/u1/ktp.jpg",
    diplomaDocumentPath: null,
    profileSubmittedAt: "2026-08-01T00:00:00.000Z",
    verificationStatus: "PENDING",
    subjects: [{ id: "s1", name: "Matematika" }],
    gradeLevels: [{ id: "g1", name: "SMA" }],
    user: { id: "u1", name: "Budi Santoso", email: "budi@example.com", phone: "+62812345" },
    ...overrides,
  };
}

describe("TutorApprovalQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTutorDocumentUrl.mockResolvedValue("blob:fake-url");
  });

  it("lists pending tutors and shows an empty state when there are none", async () => {
    listPendingTutors.mockResolvedValue([]);
    render(<TutorApprovalQueue />);
    expect(await screen.findByText("Menunggu Persetujuan (0)")).toBeInTheDocument();
    expect(screen.getByText("Tidak ada tutor yang menunggu.")).toBeInTheDocument();
  });

  it("shows profile detail when a tutor is selected", async () => {
    listPendingTutors.mockResolvedValue([makeTutor()]);
    render(<TutorApprovalQueue />);

    fireEvent.click(await screen.findByText("Budi Santoso"));

    expect(await screen.findByText("S1 Fisika")).toBeInTheDocument();
    expect(screen.getByText("Pengajar berpengalaman")).toBeInTheDocument();
  });

  it("approves a tutor and refreshes the queue", async () => {
    listPendingTutors.mockResolvedValueOnce([makeTutor()]).mockResolvedValueOnce([]);
    verifyTutor.mockResolvedValue({ ...makeTutor(), verificationStatus: "VERIFIED" });
    render(<TutorApprovalQueue />);

    fireEvent.click(await screen.findByText("Budi Santoso"));
    fireEvent.click(await screen.findByRole("button", { name: "Setujui" }));

    await waitFor(() =>
      expect(verifyTutor).toHaveBeenCalledWith("tp1", { status: "VERIFIED" }),
    );
    expect(listPendingTutors).toHaveBeenCalledTimes(2);
  });

  it("requires a reason before rejecting", async () => {
    listPendingTutors.mockResolvedValue([makeTutor()]);
    render(<TutorApprovalQueue />);

    fireEvent.click(await screen.findByText("Budi Santoso"));
    fireEvent.click(await screen.findByRole("button", { name: "Tolak" }));
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Tolak" }));

    expect(await screen.findByText("Alasan penolakan wajib diisi.")).toBeInTheDocument();
    expect(verifyTutor).not.toHaveBeenCalled();
  });

  it("rejects a tutor with a reason", async () => {
    listPendingTutors.mockResolvedValueOnce([makeTutor()]).mockResolvedValueOnce([]);
    verifyTutor.mockResolvedValue({ ...makeTutor(), verificationStatus: "REJECTED" });
    render(<TutorApprovalQueue />);

    fireEvent.click(await screen.findByText("Budi Santoso"));
    fireEvent.click(await screen.findByRole("button", { name: "Tolak" }));
    fireEvent.change(screen.getByLabelText("Alasan penolakan"), {
      target: { value: "Dokumen tidak jelas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Tolak" }));

    await waitFor(() =>
      expect(verifyTutor).toHaveBeenCalledWith("tp1", {
        status: "REJECTED",
        reason: "Dokumen tidak jelas",
      }),
    );
  });

  it("shows a document link once fetched, and a fallback when missing", async () => {
    listPendingTutors.mockResolvedValue([makeTutor()]);
    render(<TutorApprovalQueue />);

    fireEvent.click(await screen.findByText("Budi Santoso"));

    expect(await screen.findByRole("link", { name: "Lihat KTP" })).toHaveAttribute(
      "href",
      "blob:fake-url",
    );
    expect(screen.getByText("Ijazah tidak tersedia")).toBeInTheDocument();
  });
});
