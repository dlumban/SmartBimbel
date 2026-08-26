import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NewBookingForm } from "./NewBookingForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const getTutorDetail = vi.fn();
const getTutorSchedule = vi.fn();
vi.mock("../lib/discovery", () => ({
  getTutorDetail: (...args: unknown[]) => getTutorDetail(...args),
  getTutorSchedule: (...args: unknown[]) => getTutorSchedule(...args),
}));

const createBooking = vi.fn();
vi.mock("../lib/bookings", () => ({
  createBooking: (...args: unknown[]) => createBooking(...args),
}));

function makeTutor(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    name: "Budi Santoso",
    photoUrl: null,
    bio: "hi",
    subjects: ["Matematika"],
    subjectOptions: [{ id: "s1", name: "Matematika" }],
    gradeLevels: ["SMA 10-12"],
    hourlyRate: 100000,
    rating: null,
    reviewCount: 0,
    city: "Jakarta Selatan",
    teachingModes: ["ONLINE"],
    education: null,
    ...overrides,
  };
}

// Navigates to next week (always entirely future regardless of what day
// the suite runs on) and picks a slot there, same technique the old
// slot-based tests used.
function selectFirstFutureSlot() {
  fireEvent.click(screen.getByRole("button", { name: /Minggu Berikutnya/ }));
  fireEvent.click(screen.getAllByTitle("08:00")[2]);
}

describe("NewBookingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTutorSchedule.mockResolvedValue([]);
  });

  it("shows an error state when no tutorId is present", async () => {
    render(<NewBookingForm tutorId={null} />);
    expect(await screen.findByText("Tutor tidak ditemukan")).toBeInTheDocument();
    expect(getTutorDetail).not.toHaveBeenCalled();
  });

  it("shows an error state when the tutor fails to load", async () => {
    getTutorDetail.mockRejectedValue(new Error("boom"));
    render(<NewBookingForm tutorId="t1" />);
    expect(await screen.findByText("Gagal memuat data tutor.")).toBeInTheDocument();
  });

  it("auto-selects the only subject and mode when there's just one each", async () => {
    getTutorDetail.mockResolvedValue(makeTutor());
    render(<NewBookingForm tutorId="t1" />);

    await screen.findByText("Booking dengan Budi Santoso");
    expect(screen.getByLabelText("Mata pelajaran")).toHaveValue("s1");
    expect(screen.getByLabelText("Metode")).toHaveValue("ONLINE");
  });

  it("keeps submit disabled until a slot is picked, then submits the full payload", async () => {
    getTutorDetail.mockResolvedValue(makeTutor());
    createBooking.mockResolvedValue({ id: "b1" });
    render(<NewBookingForm tutorId="t1" />);

    await screen.findByText("Booking dengan Budi Santoso");
    const submit = screen.getByRole("button", { name: "Kirim Permintaan Booking" });
    expect(submit).toBeDisabled();

    selectFirstFutureSlot();
    expect(submit).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Catatan (opsional)"), {
      target: { value: "Fokus ke aljabar" },
    });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          tutorId: "t1",
          startTime: "08:00",
          subjectId: "s1",
          mode: "ONLINE",
          durationMinutes: 30,
          notes: "Fokus ke aljabar",
          scheduledDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/bookings/b1"));
  });

  it("renders the tutor's real busy times from the public schedule, inert (not clickable)", async () => {
    getTutorDetail.mockResolvedValue(makeTutor());
    const future = new Date();
    future.setDate(future.getDate() + 7);
    future.setHours(9, 0, 0, 0);
    getTutorSchedule.mockResolvedValue([{ scheduledAt: future.toISOString(), durationMinutes: 30 }]);
    render(<NewBookingForm tutorId="t1" />);

    await screen.findByText("Booking dengan Budi Santoso");
    fireEvent.click(screen.getByRole("button", { name: /Minggu Berikutnya/ }));

    expect(await screen.findByTitle("09:00-09:30")).toBeDisabled();
  });

  it("shows a submit error without navigating away on failure", async () => {
    getTutorDetail.mockResolvedValue(makeTutor());
    createBooking.mockRejectedValue(new Error("This time is no longer available."));
    render(<NewBookingForm tutorId="t1" />);

    await screen.findByText("Booking dengan Budi Santoso");
    selectFirstFutureSlot();
    fireEvent.click(screen.getByRole("button", { name: "Kirim Permintaan Booking" }));

    expect(await screen.findByText("This time is no longer available.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
