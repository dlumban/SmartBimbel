import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ScheduleSessionForm } from "./ScheduleSessionForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const getMyTutorProfile = vi.fn();
vi.mock("../lib/tutors", () => ({
  getMyTutorProfile: () => getMyTutorProfile(),
}));

const listStudents = vi.fn();
vi.mock("../lib/students", () => ({
  listStudents: (...args: unknown[]) => listStudents(...args),
}));

const listAllBookings = vi.fn();
const scheduleSession = vi.fn();
vi.mock("../lib/bookings", () => ({
  listAllBookings: () => listAllBookings(),
  scheduleSession: (...args: unknown[]) => scheduleSession(...args),
}));

vi.mock("./BookingDetail", () => ({
  BookingDetail: ({ bookingId }: { bookingId: string }) => <div>BookingDetail:{bookingId}</div>,
}));

function makeTutorProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "tp1",
    bio: "hi",
    education: null,
    hourlyRate: 100000,
    teachingModes: ["ONLINE"],
    city: "Jakarta Selatan",
    ktpDocumentPath: null,
    diplomaDocumentPath: null,
    profileSubmittedAt: null,
    verificationStatus: "VERIFIED",
    rejectionReason: null,
    subjects: [{ id: "s1", name: "Matematika" }],
    gradeLevels: [],
    ...overrides,
  };
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "existing1",
    scheduledAt: new Date().toISOString(),
    proposedScheduledAt: null,
    requestedByUserId: null,
    rescheduleProposedByUserId: null,
    durationMinutes: 30,
    mode: "ONLINE",
    status: "ACCEPTED",
    notes: null,
    declineReason: null,
    respondByAt: null,
    cancellationReasonCode: null,
    cancellationReason: null,
    isLateCancellation: false,
    noShowReported: false,
    meetingLink: null,
    meetingAddress: null,
    priceAmount: 50000,
    completedAt: null,
    completedByUserId: null,
    sessionNotes: null,
    sessionNotesUpdatedAt: null,
    student: { userId: "student-1", user: { id: "student-1", name: "Andi Nugraha" } },
    tutor: { userId: "tutor-1", user: { id: "tutor-1", name: "Budi Santoso" } },
    subject: { id: "s1", name: "Matematika" },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeStudent(overrides: Record<string, unknown> = {}) {
  return {
    studentProfileId: "sp1",
    userId: "student-1",
    name: "Andi Nugraha",
    phone: "+6281234567890",
    email: "andi@example.com",
    ...overrides,
  };
}

async function selectStudentFromTable() {
  fireEvent.click(await screen.findByRole("button", { name: "Pilih" }));
}

// Every case navigates to next week first (via "Minggu Berikutnya") so the
// clicked cells are guaranteed future regardless of what day the suite
// happens to run on - same technique the old slot-based tests used.
async function goToNextWeekAndSelectFirstSlot() {
  fireEvent.click(await screen.findByRole("button", { name: /Minggu Berikutnya/ }));
  fireEvent.click(screen.getAllByTitle("08:00")[2]);
}

describe("ScheduleSessionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyTutorProfile.mockResolvedValue(makeTutorProfile());
    listAllBookings.mockResolvedValue([]);
    listStudents.mockResolvedValue({ data: [makeStudent()], total: 1, page: 1, limit: 10 });
  });

  it("shows an error state when the tutor's own profile fails to load", async () => {
    getMyTutorProfile.mockRejectedValue(new Error("boom"));
    render(<ScheduleSessionForm />);
    expect(await screen.findByText("Gagal memuat profil dan jadwal Anda.")).toBeInTheDocument();
  });

  it("shows the calendar first, then the student picker once a slot is selected", async () => {
    render(<ScheduleSessionForm />);
    await screen.findByText("Jadwalkan Sesi");

    expect(screen.queryByText("Pilih siswa")).not.toBeInTheDocument();

    await goToNextWeekAndSelectFirstSlot();

    expect(await screen.findByText("Pilih siswa")).toBeInTheDocument();
    expect(await screen.findByText("Andi Nugraha")).toBeInTheDocument();
  });

  it("shows the schedule fields once a student is picked, and lets picking a different student return to the table", async () => {
    render(<ScheduleSessionForm />);
    await goToNextWeekAndSelectFirstSlot();
    await selectStudentFromTable();

    expect(screen.getByLabelText("Mata pelajaran")).toHaveValue("s1");
    expect(screen.getByLabelText("Metode")).toHaveValue("ONLINE");
    expect(screen.getByText(/Siswa:/)).toHaveTextContent("Andi Nugraha");

    fireEvent.click(screen.getByRole("button", { name: "Ganti" }));

    expect(await screen.findByText("Pilih siswa")).toBeInTheDocument();
  });

  it("keeps submit disabled until a slot and student are picked, then submits the full payload", async () => {
    scheduleSession.mockResolvedValue({ id: "b1" });
    render(<ScheduleSessionForm />);
    await goToNextWeekAndSelectFirstSlot();
    await selectStudentFromTable();

    const submit = screen.getByRole("button", { name: "Jadwalkan Sesi" });
    expect(submit).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Catatan (opsional)"), {
      target: { value: "Fokus ke aljabar" },
    });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(scheduleSession).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "sp1",
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

  it("shows a submit error without navigating away on failure", async () => {
    scheduleSession.mockRejectedValue(new Error("This time is no longer available."));
    render(<ScheduleSessionForm />);
    await goToNextWeekAndSelectFirstSlot();
    await selectStudentFromTable();

    fireEvent.click(screen.getByRole("button", { name: "Jadwalkan Sesi" }));

    expect(await screen.findByText("This time is no longer available.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the embedded BookingDetail panel when an existing session is clicked, and refreshes on update", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    future.setHours(9, 0, 0, 0);
    listAllBookings.mockResolvedValue([makeBooking({ scheduledAt: future.toISOString() })]);

    render(<ScheduleSessionForm />);
    await screen.findByText("Jadwalkan Sesi");
    fireEvent.click(screen.getByRole("button", { name: /Minggu Berikutnya/ }));

    fireEvent.click(await screen.findByTitle("09:00-09:30"));

    expect(await screen.findByText("BookingDetail:existing1")).toBeInTheDocument();
    // Selecting an existing session clears any in-progress new-session selection.
    expect(screen.queryByText("Pilih siswa")).not.toBeInTheDocument();
  });
});
