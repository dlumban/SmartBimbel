import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TutorVerificationStatus } from "./TutorVerificationStatus";

const getMyTutorProfile = vi.fn();

vi.mock("../lib/tutors", () => ({
  getMyTutorProfile: () => getMyTutorProfile(),
}));

describe("TutorVerificationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when there is no tutor profile yet", async () => {
    getMyTutorProfile.mockResolvedValue(null);
    const { container } = render(<TutorVerificationStatus />);
    await vi.waitFor(() => expect(container.textContent).toBe(""));
  });

  it("shows a pending badge with an explanation", async () => {
    getMyTutorProfile.mockResolvedValue({
      verificationStatus: "PENDING",
      rejectionReason: null,
    });
    render(<TutorVerificationStatus />);
    expect(await screen.findByText("Menunggu verifikasi")).toBeInTheDocument();
    expect(
      screen.getByText(/Tim kami sedang meninjau profil Anda/),
    ).toBeInTheDocument();
  });

  it("shows a verified badge", async () => {
    getMyTutorProfile.mockResolvedValue({ verificationStatus: "VERIFIED", rejectionReason: null });
    render(<TutorVerificationStatus />);
    expect(await screen.findByText("Terverifikasi")).toBeInTheDocument();
  });

  it("shows the rejection reason when rejected", async () => {
    getMyTutorProfile.mockResolvedValue({
      verificationStatus: "REJECTED",
      rejectionReason: "Dokumen tidak lengkap",
    });
    render(<TutorVerificationStatus />);
    expect(await screen.findByText("Ditolak")).toBeInTheDocument();
    expect(screen.getByText("Dokumen tidak lengkap")).toBeInTheDocument();
  });
});
