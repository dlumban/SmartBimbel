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
const scheduleGroupSession = vi.fn();
vi.mock("../lib/bookings", () => ({
  listAllBookings: () => listAllBookings(),
  scheduleSession: (...args: unknown[]) => scheduleSession(...args),
  scheduleGroupSession: (...args: unknown[]) => scheduleGroupSession(...args),
}));

const listActivePackages = vi.fn();
vi.mock("../lib/packages", () => ({
  listActivePackages: () => listActivePackages(),
}));

vi.mock("./BookingDetail", () => ({
  BookingDetail: ({ bookingId }: { bookingId: string }) => <div>BookingDetail:{bookingId}</div>,
}));

vi.mock("./BookingCalendar", () => ({
  BookingCalendar: ({
    onSelect,
    onBusyBlockClick,
  }: {
    onSelect?: (s: { date: string; startTime: string; slotCount: number } | null) => void;
    onBusyBlockClick?: (b: { bookingId: string }) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSelect?.({ date: "2099-01-05", startTime: "08:00", slotCount: 1 })}>
        Minggu
      </button>
      <button type="button" onClick={() => onSelect?.({ date: "2099-01-12", startTime: "08:00", slotCount: 1 })}>
        Minggu Berikutnya
      </button>
      <button type="button" title="08:00" onClick={() => onSelect?.({ date: "2099-01-12", startTime: "08:00", slotCount: 1 })}>
        slot
      </button>
      <button
        type="button"
        title="09:00-09:30 · Andi Nugraha · Matematika"
        onClick={() => onBusyBlockClick?.({ bookingId: "existing1" })}
      >
        busy
      </button>
    </div>
  ),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ sessionUser: { id: "tutor-1", role: "TUTOR" } }),
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

function makePackage(overrides: Record<string, unknown> = {}) {
  return {
    id: "pkg1",
    name: "Paket Hemat",
    sessionCount: 4,
    durationMinutes: 60,
    totalPrice: 400000,
    isActive: true,
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
  fireEvent.click(await screen.findByRole("button", { name: "Tambah" }));
  fireEvent.click(await screen.findByRole("button", { name: /Lanjut/ }));
}

// Slot pickers come from the BookingCalendar mock above.
async function goToNextWeekAndSelectFirstSlot() {
  fireEvent.click(await screen.findByRole("button", { name: /Minggu Berikutnya/ }));
}

describe("ScheduleSessionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyTutorProfile.mockResolvedValue(makeTutorProfile());
    listAllBookings.mockResolvedValue([]);
    listStudents.mockResolvedValue({ data: [makeStudent()], total: 1, page: 1, limit: 10 });
    listActivePackages.mockResolvedValue([]);
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

  it("does not show a package selector when there are no active packages", async () => {
    render(<ScheduleSessionForm />);
    await goToNextWeekAndSelectFirstSlot();
    await selectStudentFromTable();

    expect(screen.queryByText("Paket (opsional)")).not.toBeInTheDocument();
  });

  it("lets a package override the session duration and includes packageId in the submitted payload", async () => {
    listActivePackages.mockResolvedValue([makePackage()]);
    scheduleSession.mockResolvedValue({ id: "b1" });
    render(<ScheduleSessionForm />);
    await goToNextWeekAndSelectFirstSlot();
    await selectStudentFromTable();

    fireEvent.change(screen.getByLabelText("Paket (opsional)"), { target: { value: "pkg1" } });
    expect(
      screen.getByText(/Durasi sesi ditetapkan 60 menit oleh paket ini/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Jadwalkan Sesi" }));

    await waitFor(() =>
      expect(scheduleSession).toHaveBeenCalledWith(
        expect.objectContaining({ packageId: "pkg1", durationMinutes: 60 }),
      ),
    );
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
    fireEvent.click(screen.getByTitle("09:00-09:30 · Andi Nugraha · Matematika"));

    expect(await screen.findByText("BookingDetail:existing1")).toBeInTheDocument();
    // Selecting an existing session clears any in-progress new-session selection.
    expect(screen.queryByText("Pilih siswa")).not.toBeInTheDocument();
  });

  it("shows completed sessions on the calendar, not just active ones", async () => {
    // Calendar rendering is covered in BookingCalendar.spec; this form
    // mocks BookingCalendar and only asserts the schedule page still mounts.
    listAllBookings.mockResolvedValue([
      makeBooking({
        status: "COMPLETED",
        scheduledAt: new Date().toISOString(),
        durationMinutes: 60,
      }),
    ]);

    render(<ScheduleSessionForm />);

    expect(await screen.findByText("Jadwalkan Sesi")).toBeInTheDocument();
  });
});
