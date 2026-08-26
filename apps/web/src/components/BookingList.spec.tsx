import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BookingList } from "./BookingList";

const listBookings = vi.fn();
vi.mock("../lib/bookings", async () => {
  const actual = await vi.importActual<typeof import("../lib/bookings")>("../lib/bookings");
  return { ...actual, listBookings: (...args: unknown[]) => listBookings(...args) };
});

let sessionUser: { id: string; role: string } | null = { id: "student-1", role: "STUDENT" };
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ sessionUser }),
}));

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    scheduledAt: "2026-09-01T09:00:00.000Z",
    proposedScheduledAt: null,
    durationMinutes: 60,
    mode: "ONLINE",
    status: "REQUESTED",
    notes: null,
    declineReason: null,
    respondByAt: null,
    student: { userId: "student-1", user: { id: "student-1", name: "Andi" } },
    tutor: { userId: "tutor-1", user: { id: "tutor-1", name: "Budi Santoso" } },
    subject: { id: "s1", name: "Matematika" },
    createdAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("BookingList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "student-1", role: "STUDENT" };
  });

  it("shows an empty state for the default upcoming tab", async () => {
    listBookings.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    render(<BookingList />);
    expect(await screen.findByText("Belum ada sesi yang akan datang.")).toBeInTheDocument();
    expect(listBookings).toHaveBeenCalledWith({ bucket: "upcoming", page: 1, limit: 20 });
  });

  it("renders a booking with the counterpart's name and status badge", async () => {
    listBookings.mockResolvedValue({ data: [makeBooking()], total: 1, page: 1, limit: 20 });
    render(<BookingList />);

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Matematika")).toBeInTheDocument();
    expect(screen.getByText("Menunggu konfirmasi")).toBeInTheDocument();
  });

  it("switches tabs and refetches with the new bucket", async () => {
    listBookings.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    render(<BookingList />);
    await screen.findByText("Belum ada sesi yang akan datang.");

    listBookings.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    fireEvent.click(screen.getByRole("button", { name: "Dibatalkan" }));

    await waitFor(() =>
      expect(listBookings).toHaveBeenCalledWith({ bucket: "cancelled", page: 1, limit: 20 }),
    );
    expect(await screen.findByText("Tidak ada booking yang dibatalkan.")).toBeInTheDocument();
  });

  it("shows the student's name to a tutor viewing the list", async () => {
    sessionUser = { id: "tutor-1", role: "TUTOR" };
    listBookings.mockResolvedValue({ data: [makeBooking()], total: 1, page: 1, limit: 20 });
    render(<BookingList />);
    expect(await screen.findByText("Andi")).toBeInTheDocument();
  });

  it("fetches at most LIMIT bookings and links to the full calendar when there are more", async () => {
    listBookings.mockResolvedValue({
      data: [makeBooking()],
      total: 25,
      page: 1,
      limit: 20,
    });
    render(<BookingList />);

    await waitFor(() =>
      expect(listBookings).toHaveBeenCalledWith({ bucket: "upcoming", page: 1, limit: 20 }),
    );
    const link = await screen.findByRole("link", { name: /Lihat kalender lengkap/ });
    expect(link).toHaveAttribute("href", "/bookings/calendar");
  });

  it("does not show the full-calendar link when everything already fits", async () => {
    listBookings.mockResolvedValue({
      data: [makeBooking()],
      total: 1,
      page: 1,
      limit: 20,
    });
    render(<BookingList />);

    await screen.findByText("Budi Santoso");
    expect(screen.queryByRole("link", { name: /Lihat kalender lengkap/ })).not.toBeInTheDocument();
  });

  it("shows an error state and retries on demand", async () => {
    listBookings.mockRejectedValue(new Error("boom"));
    render(<BookingList />);
    await screen.findByText("Gagal memuat booking.");

    listBookings.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    expect(await screen.findByText("Belum ada sesi yang akan datang.")).toBeInTheDocument();
  });
});
