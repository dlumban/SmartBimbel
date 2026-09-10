import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StudentScheduleList, selectDisplayedStudentSessions } from "./StudentScheduleList";

const listAllBookings = vi.fn();
vi.mock("../lib/bookings", () => ({
  listAllBookings: () => listAllBookings(),
  BOOKING_STATUS_LABELS: {
    CONFIRMED: "Terkonfirmasi",
    COMPLETED: "Selesai",
    CANCELLED: "Dibatalkan",
  },
  BOOKING_STATUS_BADGE_VARIANT: {
    CONFIRMED: "default",
    COMPLETED: "success",
    CANCELLED: "offline",
  },
}));

const listStudents = vi.fn();
vi.mock("../lib/students", () => ({
  listStudents: (...args: unknown[]) => listStudents(...args),
}));

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    scheduledAt: "2026-09-01T08:30:00.000Z",
    durationMinutes: 60,
    status: "CONFIRMED",
    student: { userId: "student-1", user: { id: "student-1", name: "Andi Nugraha" } },
    tutor: { userId: "tutor-1", user: { id: "tutor-1", name: "Budi" } },
    subject: { id: "s1", name: "Matematika" },
    ...overrides,
  };
}

const TODAY = new Date(2026, 7, 31, 12, 0, 0);

describe("selectDisplayedStudentSessions", () => {
  it("returns up to 20 upcoming sessions from today, sorted ascending", () => {
    const bookings = Array.from({ length: 25 }, (_, i) =>
      makeBooking({
        id: `future-${i}`,
        scheduledAt: new Date(2026, 7, 31 + i, 10, 0).toISOString(),
        subject: { id: `s${i}`, name: `Subject ${i}` },
      }),
    );

    const displayed = selectDisplayedStudentSessions(bookings, TODAY);

    expect(displayed).toHaveLength(20);
    expect(displayed[0].id).toBe("future-0");
    expect(displayed[19].id).toBe("future-19");
    expect(new Date(displayed[0].scheduledAt).getTime()).toBeLessThanOrEqual(
      new Date(displayed[1].scheduledAt).getTime(),
    );
  });

  it("returns the 20 most recent past sessions when none exist from today onward", () => {
    const bookings = Array.from({ length: 25 }, (_, i) =>
      makeBooking({
        id: `past-${i}`,
        scheduledAt: new Date(2026, 7, i + 1, 10, 0).toISOString(),
        subject: { id: `s${i}`, name: `Subject ${i}` },
      }),
    );

    const displayed = selectDisplayedStudentSessions(bookings, TODAY);

    expect(displayed).toHaveLength(20);
    expect(displayed[0].id).toBe("past-5");
    expect(displayed[19].id).toBe("past-24");
  });
});

describe("StudentScheduleList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listStudents.mockResolvedValue({
      data: [
        {
          studentProfileId: "sp1",
          userId: "student-1",
          name: "Andi Nugraha",
          phone: null,
          email: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    });
  });

  it("lists sessions for the selected student with day, date, time, and subject", async () => {
    const todaySession = new Date();
    todaySession.setHours(15, 0, 0, 0);

    listAllBookings.mockResolvedValue([
      makeBooking({ scheduledAt: todaySession.toISOString() }),
      makeBooking({
        id: "b2",
        scheduledAt: new Date(todaySession.getTime() + 86400000 * 2).toISOString(),
        subject: { id: "s2", name: "Bahasa Inggris" },
        student: { userId: "student-2", user: { id: "student-2", name: "Other" } },
      }),
    ]);

    render(<StudentScheduleList studentUserId="student-1" />);

    expect(await screen.findByText("Jadwal Andi Nugraha")).toBeInTheDocument();
    expect(listStudents).toHaveBeenCalledWith({ mine: true, limit: 50 });
    expect(screen.getByText("Matematika")).toBeInTheDocument();
    expect(screen.queryByText("Bahasa Inggris")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /15\.00|3:00 PM/i })).toHaveAttribute("href", "/bookings/b1");
    expect(screen.getByText("Laporan Gabungan")).toBeInTheDocument();
  });

  it("lists reportable sessions for combined PDF selection", async () => {
    const todaySession = new Date();
    todaySession.setHours(15, 0, 0, 0);
    listAllBookings.mockResolvedValue([
      makeBooking({
        scheduledAt: todaySession.toISOString(),
        sessionNotes: "<p>Materi pecahan</p>",
      }),
    ]);

    render(<StudentScheduleList studentUserId="student-1" />);

    expect(await screen.findByRole("checkbox", { name: /Pilih sesi/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Buat PDF/ })).toBeDisabled();
  });

  it("shows an empty state when the student has no sessions", async () => {
    listAllBookings.mockResolvedValue([]);

    render(<StudentScheduleList studentUserId="student-1" />);

    expect(await screen.findByText("Belum ada sesi untuk siswa ini.")).toBeInTheDocument();
  });

  it("still loads bookings when the student list request fails", async () => {
    listStudents.mockRejectedValue(new Error("Failed to load students (400)"));
    const todaySession = new Date();
    todaySession.setHours(15, 0, 0, 0);
    listAllBookings.mockResolvedValue([
      makeBooking({ scheduledAt: todaySession.toISOString() }),
    ]);

    render(<StudentScheduleList studentUserId="student-1" />);

    expect(await screen.findByText("Jadwal Andi Nugraha")).toBeInTheDocument();
    expect(screen.getByText("Matematika")).toBeInTheDocument();
  });
});
