import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BookingCalendar } from "./BookingCalendar";

const listAllBookings = vi.fn();
vi.mock("../lib/bookings", () => ({
  listAllBookings: () => listAllBookings(),
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

    expect(await screen.findByTitle(/Budi Santoso/)).toBeInTheDocument();
  });

  it("excludes cancelled bookings when includeCancelled is false", async () => {
    listAllBookings.mockResolvedValue([makeBooking({ status: "CANCELLED" })]);
    render(<BookingCalendar includeCancelled={false} />);

    await screen.findByText("15");
    expect(screen.queryByTitle(/Budi Santoso/)).not.toBeInTheDocument();
  });
});
