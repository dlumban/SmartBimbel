import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BookingsManagement } from "./BookingsManagement";

const searchBookings = vi.fn();
const getAdminBookingDetail = vi.fn();
const overrideCancelBooking = vi.fn();
vi.mock("../lib/bookings", async () => {
  const actual = await vi.importActual<typeof import("../lib/bookings")>("../lib/bookings");
  return {
    ...actual,
    searchBookings: (...args: unknown[]) => searchBookings(...args),
    getAdminBookingDetail: (...args: unknown[]) => getAdminBookingDetail(...args),
    overrideCancelBooking: (...args: unknown[]) => overrideCancelBooking(...args),
  };
});

let sessionUser: { adminRole: string | null } | null = { adminRole: "SUPER_ADMIN" };
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ sessionUser }),
}));

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    scheduledAt: "2026-09-01T09:00:00.000Z",
    durationMinutes: 60,
    mode: "ONLINE",
    status: "CONFIRMED",
    notes: null,
    declineReason: null,
    cancellationReason: null,
    cancellationReasonCode: null,
    isLateCancellation: false,
    noShowReported: false,
    meetingLink: null,
    meetingAddress: null,
    sessionNotes: null,
    sessionNotesUpdatedAt: null,
    completedAt: null,
    proposedScheduledAt: null,
    statusHistory: [],
    review: null,
    transaction: null,
    student: { user: { id: "s1", name: "Andi" } },
    tutor: { user: { id: "t1", name: "Budi" }, city: "Jakarta" },
    subject: { id: "sub1", name: "Matematika" },
    ...overrides,
  };
}

describe("BookingsManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { adminRole: "SUPER_ADMIN" };
    searchBookings.mockResolvedValue({ data: [makeBooking()], total: 1, page: 1, limit: 20 });
  });

  it("lists bookings", async () => {
    render(<BookingsManagement />);
    expect(await screen.findByText("Matematika")).toBeInTheDocument();
  });

  it("shows detail and lets a Super Admin force-cancel a non-terminal booking", async () => {
    getAdminBookingDetail.mockResolvedValue(makeBooking());
    overrideCancelBooking.mockResolvedValue(makeBooking({ status: "CANCELLED" }));
    render(<BookingsManagement />);

    fireEvent.click(await screen.findByText("Matematika"));
    fireEvent.click(await screen.findByRole("button", { name: "Batalkan Paksa (Admin Override)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Konfirmasi Pembatalan" }));

    expect(await screen.findByText("Alasan pembatalan wajib diisi.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Alasan pembatalan paksa"), {
      target: { value: "Edge case" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Pembatalan" }));

    await waitFor(() => expect(overrideCancelBooking).toHaveBeenCalledWith("b1", "Edge case"));
  });

  it("hides the override action for a Support admin", async () => {
    sessionUser = { adminRole: "SUPPORT" };
    getAdminBookingDetail.mockResolvedValue(makeBooking());
    render(<BookingsManagement />);

    fireEvent.click(await screen.findByText("Matematika"));
    await screen.findByText("Jakarta");

    expect(
      screen.queryByRole("button", { name: "Batalkan Paksa (Admin Override)" }),
    ).not.toBeInTheDocument();
  });

  it("hides the override action for an already-terminal booking", async () => {
    getAdminBookingDetail.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
    render(<BookingsManagement />);

    fireEvent.click(await screen.findByText("Matematika"));
    await screen.findByText("Jakarta");

    expect(
      screen.queryByRole("button", { name: "Batalkan Paksa (Admin Override)" }),
    ).not.toBeInTheDocument();
  });
});
