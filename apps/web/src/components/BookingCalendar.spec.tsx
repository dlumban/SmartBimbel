import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BookingCalendar } from "./BookingCalendar";

const listAllBookings = vi.fn();
vi.mock("../lib/bookings", () => ({
  listAllBookings: () => listAllBookings(),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ sessionUser: { id: "student-1", role: "STUDENT" } }),
}));

function makeBooking(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: "b1",
    scheduledAt: new Date(now.getFullYear(), now.getMonth(), 15, 9, 0).toISOString(),
    proposedScheduledAt: null,
    durationMinutes: 60,
    mode: "ONLINE",
    status: "CANCELLED",
    notes: null,
    declineReason: null,
    respondByAt: null,
    student: { userId: "student-1", user: { id: "student-1", name: "Andi" } },
    tutor: { userId: "tutor-1", user: { id: "tutor-1", name: "Budi Santoso" } },
    subject: { id: "s1", name: "Matematika" },
    createdAt: now.toISOString(),
    ...overrides,
  };
}

describe("BookingCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes cancelled bookings by default", async () => {
    listAllBookings.mockResolvedValue([makeBooking({ status: "CANCELLED" })]);
    render(<BookingCalendar />);

    expect(await screen.findByTitle(/Budi Santoso · Matematika/)).toBeInTheDocument();
    expect(screen.getByText("Matematika")).toBeInTheDocument();
  });

  it("excludes cancelled bookings when includeCancelled is false", async () => {
    listAllBookings.mockResolvedValue([makeBooking({ status: "CANCELLED" })]);
    render(<BookingCalendar includeCancelled={false} />);

    await screen.findByText("15");
    expect(screen.queryByTitle(/Budi Santoso/)).not.toBeInTheDocument();
  });

  it("toggles between month and week views", async () => {
    listAllBookings.mockResolvedValue([makeBooking({ status: "CONFIRMED" })]);
    render(<BookingCalendar />);

    await screen.findByText("15");
    const viewButtons = screen.getAllByRole("button", { name: "Minggu" });
    fireEvent.click(viewButtons[0]);

    expect(await screen.findByRole("button", { name: /Minggu Sebelumnya/ })).toBeInTheDocument();
    expect(screen.queryByText("Sebelumnya")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bulan" }));
    expect(await screen.findByText("15")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Minggu Sebelumnya/ })).not.toBeInTheDocument();
  });
});
