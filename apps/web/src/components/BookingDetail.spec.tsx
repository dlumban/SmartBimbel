import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BookingDetail } from "./BookingDetail";

const getBooking = vi.fn();
const getBookingHistory = vi.fn();
const acceptBooking = vi.fn();
const declineBooking = vi.fn();
const counterProposeBooking = vi.fn();
const proposeReschedule = vi.fn();
const acceptReschedule = vi.fn();
const declineReschedule = vi.fn();
const cancelBooking = vi.fn();
const editBooking = vi.fn();
const getMyTutorProfile = vi.fn();

vi.mock("../lib/bookings", async () => {
  const actual = await vi.importActual<typeof import("../lib/bookings")>("../lib/bookings");
  return {
    ...actual,
    getBooking: (...args: unknown[]) => getBooking(...args),
    getBookingHistory: (...args: unknown[]) => getBookingHistory(...args),
    acceptBooking: (...args: unknown[]) => acceptBooking(...args),
    declineBooking: (...args: unknown[]) => declineBooking(...args),
    counterProposeBooking: (...args: unknown[]) => counterProposeBooking(...args),
    proposeReschedule: (...args: unknown[]) => proposeReschedule(...args),
    acceptReschedule: (...args: unknown[]) => acceptReschedule(...args),
    declineReschedule: (...args: unknown[]) => declineReschedule(...args),
    cancelBooking: (...args: unknown[]) => cancelBooking(...args),
    editBooking: (...args: unknown[]) => editBooking(...args),
  };
});

vi.mock("../lib/tutors", () => ({
  getMyTutorProfile: (...args: unknown[]) => getMyTutorProfile(...args),
}));

let sessionUser: { id: string; role: string } | null = { id: "tutor-1", role: "TUTOR" };
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ sessionUser }),
}));

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    scheduledAt: "2026-09-01T09:00:00.000Z",
    proposedScheduledAt: null,
    rescheduleProposedByUserId: null,
    durationMinutes: 60,
    mode: "ONLINE",
    status: "REQUESTED",
    notes: null,
    declineReason: null,
    respondByAt: "2026-08-26T09:00:00.000Z",
    cancellationReasonCode: null,
    cancellationReason: null,
    isLateCancellation: false,
    noShowReported: false,
    meetingLink: null,
    meetingAddress: null,
    packageId: null,
    student: { userId: "student-1", user: { id: "student-1", name: "Andi" } },
    tutor: { userId: "tutor-1", user: { id: "tutor-1", name: "Budi Santoso" } },
    subject: { id: "s1", name: "Matematika" },
    createdAt: "2026-08-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("BookingDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "tutor-1", role: "TUTOR" };
    getBookingHistory.mockResolvedValue([]);
    getMyTutorProfile.mockResolvedValue({ subjects: [{ id: "s1", name: "Matematika" }] });
  });

  it("renders booking details with no action buttons for a terminal status", async () => {
    getBooking.mockResolvedValue(makeBooking({ status: "DECLINED", declineReason: "Bentrok" }));
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByText("Matematika")).toBeInTheDocument();
    expect(screen.getByText("Dengan Andi")).toBeInTheDocument();
    expect(screen.getByText("Ditolak")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terima" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Batalkan" })).not.toBeInTheDocument();
  });

  it("shows accept/decline/counter-propose actions for the tutor on a REQUESTED booking", async () => {
    getBooking.mockResolvedValue(makeBooking());
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByRole("button", { name: "Terima" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tolak" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usulkan waktu lain" })).toBeInTheDocument();
  });

  it("accepts the booking and refreshes the view", async () => {
    const booking = makeBooking();
    getBooking.mockResolvedValue(booking);
    acceptBooking.mockResolvedValue({ ...booking, status: "ACCEPTED" });
    render(<BookingDetail bookingId="b1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Terima" }));

    await waitFor(() => expect(acceptBooking).toHaveBeenCalledWith("b1"));
    expect(await screen.findByText("Diterima")).toBeInTheDocument();
  });

  it("declines the booking with a typed reason", async () => {
    const booking = makeBooking();
    getBooking.mockResolvedValue(booking);
    declineBooking.mockResolvedValue({ ...booking, status: "DECLINED", declineReason: "Bentrok" });
    render(<BookingDetail bookingId="b1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Tolak" }));
    fireEvent.change(screen.getByLabelText("Alasan (opsional)"), {
      target: { value: "Bentrok" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Tolak" }));

    await waitFor(() => expect(declineBooking).toHaveBeenCalledWith("b1", "Bentrok"));
    expect(await screen.findByText("Ditolak")).toBeInTheDocument();
  });

  it("submits a counter-proposal with the chosen date and time", async () => {
    const booking = makeBooking();
    getBooking.mockResolvedValue(booking);
    counterProposeBooking.mockResolvedValue({
      ...booking,
      status: "COUNTER_PROPOSED",
      proposedScheduledAt: "2026-09-08T10:00:00.000Z",
    });
    render(<BookingDetail bookingId="b1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Usulkan waktu lain" }));
    fireEvent.change(screen.getByLabelText("Tanggal baru"), { target: { value: "2026-09-08" } });
    fireEvent.change(screen.getByLabelText("Waktu baru"), { target: { value: "17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Kirim Usulan" }));

    await waitFor(() =>
      expect(counterProposeBooking).toHaveBeenCalledWith("b1", "2026-09-08", "17:00"),
    );
    expect(await screen.findByText("Usulan waktu baru")).toBeInTheDocument();
  });

  it("shows accept/decline (but not counter-propose) for the student on a COUNTER_PROPOSED booking", async () => {
    sessionUser = { id: "student-1", role: "STUDENT" };
    getBooking.mockResolvedValue(
      makeBooking({ status: "COUNTER_PROPOSED", proposedScheduledAt: "2026-09-08T10:00:00.000Z" }),
    );
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByRole("button", { name: "Terima" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tolak" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usulkan waktu lain" })).not.toBeInTheDocument();
  });

  it("shows reschedule and cancel actions for an ACCEPTED booking", async () => {
    getBooking.mockResolvedValue(makeBooking({ status: "ACCEPTED" }));
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByRole("button", { name: "Ajukan Jadwal Ulang" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Batalkan" })).toBeInTheDocument();
  });

  it("shows the cancel action (but not reschedule) for a CONFIRMED booking", async () => {
    getBooking.mockResolvedValue(
      makeBooking({
        status: "CONFIRMED",
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByRole("button", { name: "Batalkan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajukan Jadwal Ulang" })).not.toBeInTheDocument();
  });

  it("shows the edit action for a tutor-initiated, upcoming CONFIRMED booking and lets the tutor edit it", async () => {
    const booking = makeBooking({
      status: "CONFIRMED",
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      requestedByUserId: "tutor-1",
    });
    getBooking.mockResolvedValue(booking);
    editBooking.mockResolvedValue({ ...booking, durationMinutes: 90, notes: "Bawa buku" });
    render(<BookingDetail bookingId="b1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit Sesi" }));
    fireEvent.change(screen.getByLabelText("Durasi (menit)"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Catatan (opsional)"), {
      target: { value: "Bawa buku" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() =>
      expect(editBooking).toHaveBeenCalledWith(
        "b1",
        expect.objectContaining({ durationMinutes: 90, notes: "Bawa buku", subjectId: "s1" }),
      ),
    );
  });

  it("does not show the edit action for a booking the student originally requested", async () => {
    getBooking.mockResolvedValue(
      makeBooking({
        status: "CONFIRMED",
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        requestedByUserId: "student-1",
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    await screen.findByRole("button", { name: "Batalkan" });
    expect(screen.queryByRole("button", { name: "Edit Sesi" })).not.toBeInTheDocument();
  });

  it("proposes a reschedule with the chosen date and time", async () => {
    const booking = makeBooking({ status: "ACCEPTED" });
    getBooking.mockResolvedValue(booking);
    proposeReschedule.mockResolvedValue({
      ...booking,
      status: "RESCHEDULE_PROPOSED",
      proposedScheduledAt: "2026-09-15T10:00:00.000Z",
      rescheduleProposedByUserId: "tutor-1",
    });
    render(<BookingDetail bookingId="b1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Ajukan Jadwal Ulang" }));
    fireEvent.change(screen.getByLabelText("Tanggal baru"), { target: { value: "2026-09-15" } });
    fireEvent.change(screen.getByLabelText("Waktu baru"), { target: { value: "17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajukan Jadwal Ulang" }));

    await waitFor(() =>
      expect(proposeReschedule).toHaveBeenCalledWith("b1", "2026-09-15", "17:00"),
    );
    expect(await screen.findByText("Usulan jadwal ulang")).toBeInTheDocument();
  });

  it("lets the non-proposing participant accept a reschedule", async () => {
    getBooking.mockResolvedValue(
      makeBooking({
        status: "RESCHEDULE_PROPOSED",
        proposedScheduledAt: "2026-09-15T10:00:00.000Z",
        rescheduleProposedByUserId: "student-1",
      }),
    );
    acceptReschedule.mockResolvedValue(
      makeBooking({ status: "ACCEPTED", scheduledAt: "2026-09-15T10:00:00.000Z" }),
    );
    render(<BookingDetail bookingId="b1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Terima Jadwal Baru" }));
    await waitFor(() => expect(acceptReschedule).toHaveBeenCalledWith("b1"));
  });

  it("does not show respond buttons to the party who proposed the reschedule", async () => {
    getBooking.mockResolvedValue(
      makeBooking({
        status: "RESCHEDULE_PROPOSED",
        proposedScheduledAt: "2026-09-15T10:00:00.000Z",
        rescheduleProposedByUserId: "tutor-1",
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    await screen.findByText(/Menunggu Andi merespons jadwal baru/);
    expect(screen.queryByRole("button", { name: "Terima Jadwal Baru" })).not.toBeInTheDocument();
  });

  it("previews a free cancellation when the session is well outside the free window", async () => {
    getBooking.mockResolvedValue(
      makeBooking({
        status: "ACCEPTED",
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Batalkan" }));
    expect(await screen.findByText(/Pembatalan ini gratis/)).toBeInTheDocument();
  });

  it("previews a late-cancellation warning when the session is inside the free window", async () => {
    getBooking.mockResolvedValue(
      makeBooking({
        status: "ACCEPTED",
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Batalkan" }));
    expect(
      await screen.findByText(/akan tercatat sebagai pembatalan terlambat/),
    ).toBeInTheDocument();
  });

  it("always previews a free cancellation for a still-pending REQUESTED booking", async () => {
    getBooking.mockResolvedValue(
      makeBooking({
        status: "REQUESTED",
        scheduledAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Batalkan" }));
    expect(await screen.findByText(/Pembatalan ini gratis/)).toBeInTheDocument();
  });

  it("cancels a booking with a selected reason", async () => {
    const booking = makeBooking({ status: "ACCEPTED" });
    getBooking.mockResolvedValue(booking);
    cancelBooking.mockResolvedValue({
      ...booking,
      status: "CANCELLED",
      cancellationReasonCode: "ILLNESS",
      isLateCancellation: false,
    });
    render(<BookingDetail bookingId="b1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Batalkan" }));
    fireEvent.change(screen.getByLabelText("Alasan pembatalan"), {
      target: { value: "ILLNESS" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Batalkan" }));

    await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith("b1", "ILLNESS", undefined));
    expect(await screen.findByText(/Sakit/)).toBeInTheDocument();
  });

  it("shows a late-cancellation notice when applicable", async () => {
    getBooking.mockResolvedValue(
      makeBooking({
        status: "CANCELLED",
        cancellationReasonCode: "SCHEDULE_CONFLICT",
        cancellationReason: "Ada urusan mendadak",
        isLateCancellation: true,
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByText(/Jadwal bentrok/)).toBeInTheDocument();
    expect(screen.getByText("Ada urusan mendadak")).toBeInTheDocument();
    expect(screen.getByText("Dibatalkan di luar jendela pembatalan gratis.")).toBeInTheDocument();
  });

  it("does not show the no-show action", async () => {
    getBooking.mockResolvedValue(
      makeBooking({ status: "ACCEPTED", scheduledAt: "2020-01-01T09:00:00.000Z" }),
    );
    render(<BookingDetail bookingId="b1" />);
    await screen.findByRole("button", { name: "Ajukan Jadwal Ulang" });
    expect(screen.queryByRole("button", { name: "Laporkan Tidak Hadir" })).not.toBeInTheDocument();
  });

  it("renders the audit history", async () => {
    getBooking.mockResolvedValue(makeBooking({ status: "ACCEPTED" }));
    getBookingHistory.mockResolvedValue([
      {
        id: "h1",
        fromStatus: null,
        toStatus: "REQUESTED",
        changedByUserId: "student-1",
        reason: null,
        createdAt: "2026-08-25T00:00:00.000Z",
      },
      {
        id: "h2",
        fromStatus: "REQUESTED",
        toStatus: "ACCEPTED",
        changedByUserId: "tutor-1",
        reason: null,
        createdAt: "2026-08-25T01:00:00.000Z",
      },
    ]);
    render(<BookingDetail bookingId="b1" />);

    await screen.findByText("Riwayat");
    expect(screen.getAllByText(/Menunggu konfirmasi|Diterima/).length).toBeGreaterThanOrEqual(2);
  });

  it("shows an error state when loading fails", async () => {
    getBooking.mockRejectedValue(new Error("boom"));
    render(<BookingDetail bookingId="b1" />);
    expect(await screen.findByText("Gagal memuat detail booking.")).toBeInTheDocument();
  });

  it("never shows payment information on an ACCEPTED booking, to the student or the tutor", async () => {
    sessionUser = { id: "student-1", role: "STUDENT" };
    getBooking.mockResolvedValue(makeBooking({ status: "ACCEPTED", priceAmount: 100000 }));
    render(<BookingDetail bookingId="b1" />);

    await screen.findByText("Matematika");
    expect(screen.queryByRole("button", { name: "Bayar Sekarang" })).not.toBeInTheDocument();
    expect(screen.queryByText("Rp100.000")).not.toBeInTheDocument();
  });

  it("does not show the dispute or chat entry points", async () => {
    getBooking.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
    render(<BookingDetail bookingId="b1" />);

    await screen.findByText("Matematika");
    expect(screen.queryByRole("button", { name: "Ajukan Sengketa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Buka Obrolan" })).not.toBeInTheDocument();
  });

  it("shows the join-meeting section to participants once CONFIRMED", async () => {
    getBooking.mockResolvedValue(
      makeBooking({ status: "CONFIRMED", meetingLink: "https://zoom.us/j/123456789" }),
    );
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByRole("link", { name: "Gabung Sesi" })).toBeInTheDocument();
  });

  it("shows the mark-complete section only to the tutor on a CONFIRMED booking", async () => {
    getBooking.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByRole("button", { name: "Tandai Selesai" })).toBeInTheDocument();
  });

  it("does not show the mark-complete section to the student", async () => {
    sessionUser = { id: "student-1", role: "STUDENT" };
    getBooking.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
    render(<BookingDetail bookingId="b1" />);

    await screen.findByText("Matematika");
    expect(screen.queryByRole("button", { name: "Tandai Selesai" })).not.toBeInTheDocument();
  });

  it("shows session notes once COMPLETED, and the review section to the student", async () => {
    sessionUser = { id: "student-1", role: "STUDENT" };
    getBooking.mockResolvedValue(makeBooking({ status: "COMPLETED", sessionNotes: "Membahas aljabar" }));
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByText("Catatan Sesi")).toBeInTheDocument();
    expect(screen.getByText("Membahas aljabar")).toBeInTheDocument();
    expect(await screen.findByText(/Beri Ulasan|Ulasan Anda/)).toBeInTheDocument();
  });

  it("lets the tutor add session notes on a CONFIRMED booking after the session has ended", async () => {
    getBooking.mockResolvedValue(
      makeBooking({
        status: "CONFIRMED",
        scheduledAt: "2026-08-01T09:00:00.000Z",
        durationMinutes: 60,
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByText("Catatan Sesi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tambah Catatan" })).toBeInTheDocument();
  });

  it("does not show session notes to the tutor on a CONFIRMED booking before the session ends", async () => {
    getBooking.mockResolvedValue(
      makeBooking({
        status: "CONFIRMED",
        scheduledAt: "2026-12-01T09:00:00.000Z",
        durationMinutes: 60,
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByRole("button", { name: "Tandai Selesai" })).toBeInTheDocument();
    expect(screen.queryByText("Catatan Sesi")).not.toBeInTheDocument();
  });

  it("lets the tutor add session notes immediately on a tutor-initiated CONFIRMED booking, before it happens", async () => {
    getBooking.mockResolvedValue(
      makeBooking({
        status: "CONFIRMED",
        scheduledAt: "2026-12-01T09:00:00.000Z",
        durationMinutes: 60,
        requestedByUserId: "tutor-1",
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByText("Catatan Sesi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tambah Catatan" })).toBeInTheDocument();
  });

  it("lets the student see (but not edit) session notes on a CONFIRMED booking after the session has ended", async () => {
    sessionUser = { id: "student-1", role: "STUDENT" };
    getBooking.mockResolvedValue(
      makeBooking({
        status: "CONFIRMED",
        scheduledAt: "2026-08-01T09:00:00.000Z",
        durationMinutes: 60,
        sessionNotes: "Membahas aljabar",
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByText("Catatan Sesi")).toBeInTheDocument();
    expect(screen.getByText("Membahas aljabar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tambah Catatan" })).not.toBeInTheDocument();
  });

  it("does not show session notes to the student on a CONFIRMED booking before the session ends", async () => {
    sessionUser = { id: "student-1", role: "STUDENT" };
    getBooking.mockResolvedValue(
      makeBooking({
        status: "CONFIRMED",
        scheduledAt: "2026-12-01T09:00:00.000Z",
        durationMinutes: 60,
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    await screen.findByText("Matematika");
    expect(screen.queryByText("Catatan Sesi")).not.toBeInTheDocument();
  });

  it("lets the student see session notes immediately on a tutor-initiated CONFIRMED booking, before it happens", async () => {
    sessionUser = { id: "student-1", role: "STUDENT" };
    getBooking.mockResolvedValue(
      makeBooking({
        status: "CONFIRMED",
        scheduledAt: "2026-12-01T09:00:00.000Z",
        durationMinutes: 60,
        requestedByUserId: "tutor-1",
        sessionNotes: "Rencana sesi",
      }),
    );
    render(<BookingDetail bookingId="b1" />);

    expect(await screen.findByText("Catatan Sesi")).toBeInTheDocument();
    expect(screen.getByText("Rencana sesi")).toBeInTheDocument();
  });

  it("does not show the review section to the tutor", async () => {
    getBooking.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
    render(<BookingDetail bookingId="b1" />);

    await screen.findByText("Catatan Sesi");
    expect(screen.queryByText("Beri Ulasan")).not.toBeInTheDocument();
  });
});
