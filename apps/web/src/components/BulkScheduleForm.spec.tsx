import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BulkScheduleForm } from "./BulkScheduleForm";

const getMyTutorProfile = vi.fn();
vi.mock("../lib/tutors", () => ({
  getMyTutorProfile: () => getMyTutorProfile(),
}));

const listStudents = vi.fn();
vi.mock("../lib/students", () => ({
  listStudents: (...args: unknown[]) => listStudents(...args),
}));

const listAllBookings = vi.fn();
const scheduleSessionsBulk = vi.fn();
vi.mock("../lib/bookings", () => ({
  listAllBookings: () => listAllBookings(),
  scheduleSessionsBulk: (...args: unknown[]) => scheduleSessionsBulk(...args),
}));

const listActivePackages = vi.fn();
vi.mock("../lib/packages", () => ({
  listActivePackages: () => listActivePackages(),
}));

function makeTutorProfile() {
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
  };
}

function makeStudent() {
  return {
    studentProfileId: "sp1",
    userId: "student-1",
    name: "Andi Nugraha",
    phone: "+6281234567890",
    email: "andi@example.com",
  };
}

describe("BulkScheduleForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyTutorProfile.mockResolvedValue(makeTutorProfile());
    listAllBookings.mockResolvedValue([]);
    listStudents.mockResolvedValue({ data: [makeStudent()], total: 1, page: 1, limit: 10 });
    listActivePackages.mockResolvedValue([]);
    scheduleSessionsBulk.mockResolvedValue({ succeeded: [{ id: "b1" }, { id: "b2" }], failed: [] });
  });

  it("starts with student selection before showing the bulk calendar", async () => {
    render(<BulkScheduleForm />);
    expect(await screen.findByText("Jadwalkan Sesi Massal")).toBeInTheDocument();
    expect(screen.getByText("Pilih siswa")).toBeInTheDocument();
    expect(screen.queryByText("Pilih hari & jam")).not.toBeInTheDocument();
  });

  it("submits every selected slot in one bulk action", async () => {
    render(<BulkScheduleForm />);
    fireEvent.click(await screen.findByRole("button", { name: "Pilih" }));

    fireEvent.click(await screen.findByRole("button", { name: /Minggu Berikutnya/ }));
    fireEvent.click(screen.getAllByTitle("08:00")[2]);
    fireEvent.click(screen.getAllByTitle("10:00")[4]);

    fireEvent.click(screen.getByRole("button", { name: "Jadwalkan 2 Sesi" }));

    await waitFor(() =>
      expect(scheduleSessionsBulk).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "sp1",
          subjectId: "s1",
          durationMinutes: 60,
          mode: "ONLINE",
        }),
        expect.arrayContaining([
          expect.objectContaining({ startTime: "08:00" }),
          expect.objectContaining({ startTime: "10:00" }),
        ]),
      ),
    );
    expect(await screen.findByText("2 sesi berhasil dijadwalkan.")).toBeInTheDocument();
  });
});
