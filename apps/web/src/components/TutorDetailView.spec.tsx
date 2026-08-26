import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TutorDetailView } from "./TutorDetailView";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const getTutorDetail = vi.fn();
const getTutorReviews = vi.fn();
vi.mock("../lib/discovery", () => ({
  getTutorDetail: (...args: unknown[]) => getTutorDetail(...args),
  getTutorReviews: (...args: unknown[]) => getTutorReviews(...args),
}));

describe("TutorDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTutorReviews.mockResolvedValue({ data: [], page: 1, limit: 10, total: 0 });
  });

  it("renders the tutor's full profile", async () => {
    getTutorDetail.mockResolvedValue({
      id: "t1",
      name: "Budi Santoso",
      photoUrl: null,
      bio: "Pengajar berpengalaman",
      subjects: ["Matematika", "Fisika"],
      gradeLevels: ["SMA 10-12"],
      hourlyRate: 150000,
      rating: 4.5,
      reviewCount: 10,
      city: "Jakarta Selatan",
      teachingModes: ["ONLINE", "OFFLINE"],
      education: "S1 Teknik Fisika, ITB",
    });

    render(<TutorDetailView id="t1" />);

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Pengajar berpengalaman")).toBeInTheDocument();
    expect(screen.getByText("S1 Teknik Fisika, ITB")).toBeInTheDocument();
    expect(screen.getByText("Belum ada ulasan.")).toBeInTheDocument();
  });

  it("shows a not-found state for a 404", async () => {
    getTutorDetail.mockRejectedValue(new Error("NOT_FOUND"));
    render(<TutorDetailView id="missing" />);

    expect(await screen.findByText("Tutor tidak ditemukan")).toBeInTheDocument();
  });

  it("navigates to the booking stub when Pesan Sekarang is clicked", async () => {
    getTutorDetail.mockResolvedValue({
      id: "t1",
      name: "Budi Santoso",
      photoUrl: null,
      bio: "hi",
      subjects: ["Matematika"],
      gradeLevels: ["SMA 10-12"],
      hourlyRate: 150000,
      rating: null,
      reviewCount: 0,
      city: "Jakarta Selatan",
      teachingModes: ["ONLINE"],
      education: null,
    });

    render(<TutorDetailView id="t1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Pesan Sekarang" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/bookings/new?tutorId=t1"));
  });

  it("renders real reviews when present, replacing the empty state", async () => {
    getTutorDetail.mockResolvedValue({
      id: "t1",
      name: "Budi Santoso",
      photoUrl: null,
      bio: "hi",
      subjects: ["Matematika"],
      gradeLevels: ["SMA 10-12"],
      hourlyRate: 150000,
      rating: 4.5,
      reviewCount: 2,
      city: "Jakarta Selatan",
      teachingModes: ["ONLINE"],
      education: null,
    });
    getTutorReviews.mockResolvedValue({
      data: [
        { id: "r1", rating: 5, text: "Sangat membantu", createdAt: "2026-08-01T00:00:00.000Z", studentName: "Andi" },
        { id: "r2", rating: 4, text: null, createdAt: "2026-08-02T00:00:00.000Z", studentName: null },
      ],
      page: 1,
      limit: 10,
      total: 2,
    });

    render(<TutorDetailView id="t1" />);

    expect(await screen.findByText("Ulasan (2)")).toBeInTheDocument();
    expect(screen.getByText("Sangat membantu")).toBeInTheDocument();
    expect(screen.getByText("Andi")).toBeInTheDocument();
    expect(screen.getByText("Siswa")).toBeInTheDocument();
    expect(screen.queryByText("Belum ada ulasan.")).not.toBeInTheDocument();
  });
});
