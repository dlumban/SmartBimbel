import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UsersManagement } from "./UsersManagement";

const searchUsers = vi.fn();
const getUserDetail = vi.fn();
const suspendUser = vi.fn();
const reinstateUser = vi.fn();
const setAdminRole = vi.fn();
const createStudent = vi.fn();
const deleteUser = vi.fn();
const generateAccessLink = vi.fn();
vi.mock("../lib/users", async () => {
  const actual = await vi.importActual<typeof import("../lib/users")>("../lib/users");
  return {
    ...actual,
    searchUsers: (...args: unknown[]) => searchUsers(...args),
    getUserDetail: (...args: unknown[]) => getUserDetail(...args),
    suspendUser: (...args: unknown[]) => suspendUser(...args),
    reinstateUser: (...args: unknown[]) => reinstateUser(...args),
    setAdminRole: (...args: unknown[]) => setAdminRole(...args),
    createStudent: (...args: unknown[]) => createStudent(...args),
    deleteUser: (...args: unknown[]) => deleteUser(...args),
    generateAccessLink: (...args: unknown[]) => generateAccessLink(...args),
  };
});

Object.assign(navigator, { clipboard: { writeText: vi.fn() } });

vi.mock("../lib/masterData", () => ({
  getGradeLevels: () => Promise.resolve([{ id: "g1", name: "Kelas 10" }]),
  getSubjects: () => Promise.resolve([{ id: "s1", name: "Matematika" }]),
}));

let sessionUser: { adminRole: string | null } | null = { adminRole: "SUPER_ADMIN" };
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ sessionUser }),
}));

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Andi Wijaya",
    email: "andi@example.com",
    phone: "+62812345",
    role: "STUDENT",
    adminRole: null,
    status: "ACTIVE",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("UsersManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { adminRole: "SUPER_ADMIN" };
    searchUsers.mockResolvedValue({ data: [makeUser()], total: 1, page: 1, limit: 20 });
  });

  it("lists users from search", async () => {
    render(<UsersManagement />);
    expect(await screen.findByText("Andi Wijaya")).toBeInTheDocument();
  });

  it("loads and shows user detail on selection", async () => {
    getUserDetail.mockResolvedValue({ ...makeUser(), bookingCount: 3, transactionCount: 2 });
    render(<UsersManagement />);

    fireEvent.click(await screen.findByText("Andi Wijaya"));

    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("suspends a user with a required reason", async () => {
    getUserDetail
      .mockResolvedValueOnce({ ...makeUser(), bookingCount: 0, transactionCount: 0 })
      .mockResolvedValueOnce({ ...makeUser({ status: "SUSPENDED" }), bookingCount: 0, transactionCount: 0 });
    suspendUser.mockResolvedValue(makeUser({ status: "SUSPENDED" }));
    render(<UsersManagement />);

    fireEvent.click(await screen.findByText("Andi Wijaya"));
    fireEvent.click(await screen.findByRole("button", { name: "Tangguhkan" }));
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Tangguhkan" }));

    expect(await screen.findByText("Alasan penangguhan wajib diisi.")).toBeInTheDocument();
    expect(suspendUser).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Alasan penangguhan"), {
      target: { value: "Aktivitas mencurigakan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Tangguhkan" }));

    await waitFor(() =>
      expect(suspendUser).toHaveBeenCalledWith("u1", "Aktivitas mencurigakan"),
    );
  });

  it("reinstates a suspended user", async () => {
    getUserDetail.mockResolvedValue({
      ...makeUser({ status: "SUSPENDED" }),
      bookingCount: 0,
      transactionCount: 0,
    });
    searchUsers.mockResolvedValue({
      data: [makeUser({ status: "SUSPENDED" })],
      total: 1,
      page: 1,
      limit: 20,
    });
    reinstateUser.mockResolvedValue(makeUser());
    render(<UsersManagement />);

    fireEvent.click(await screen.findByText("Andi Wijaya"));
    fireEvent.click(await screen.findByRole("button", { name: "Pulihkan" }));

    await waitFor(() => expect(reinstateUser).toHaveBeenCalledWith("u1"));
  });

  it("shows admin-role actions only for a Super Admin viewing an ADMIN account", async () => {
    getUserDetail.mockResolvedValue({
      ...makeUser({ role: "ADMIN", adminRole: "SUPPORT" }),
      bookingCount: 0,
      transactionCount: 0,
    });
    render(<UsersManagement />);

    fireEvent.click(await screen.findByText("Andi Wijaya"));

    expect(await screen.findByRole("button", { name: "Jadikan Super Admin" })).toBeInTheDocument();
  });

  it("hides admin-role actions for a Support admin", async () => {
    sessionUser = { adminRole: "SUPPORT" };
    getUserDetail.mockResolvedValue({
      ...makeUser({ role: "ADMIN", adminRole: "SUPPORT" }),
      bookingCount: 0,
      transactionCount: 0,
    });
    render(<UsersManagement />);

    fireEvent.click(await screen.findByText("Andi Wijaya"));
    await screen.findByText("ADMIN");

    expect(screen.queryByRole("button", { name: "Jadikan Super Admin" })).not.toBeInTheDocument();
  });

  describe("Tambah Siswa", () => {
    it("requires a name and either a phone or email before submitting", async () => {
      render(<UsersManagement />);

      fireEvent.click(await screen.findByRole("button", { name: "Tambah Siswa" }));
      fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

      expect(await screen.findByText("Nama wajib diisi.")).toBeInTheDocument();
      expect(createStudent).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Siti Aminah" } });
      fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

      expect(await screen.findByText("Isi telepon atau email.")).toBeInTheDocument();
      expect(createStudent).not.toHaveBeenCalled();
    });

    it("creates the student and refreshes the list on success", async () => {
      createStudent.mockResolvedValue(makeUser({ id: "u9", name: "Siti Aminah" }));
      render(<UsersManagement />);

      fireEvent.click(await screen.findByRole("button", { name: "Tambah Siswa" }));
      fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Siti Aminah" } });
      fireEvent.change(screen.getByLabelText("Telepon"), { target: { value: "081234500009" } });
      fireEvent.click(await screen.findByLabelText("Matematika"));
      fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

      await waitFor(() =>
        expect(createStudent).toHaveBeenCalledWith({
          name: "Siti Aminah",
          phone: "081234500009",
          email: undefined,
          gradeLevelId: undefined,
          subjectIds: ["s1"],
          preferredLocation: undefined,
          preferredMode: undefined,
        }),
      );
      expect(searchUsers).toHaveBeenCalledTimes(2);
    });

    it("shows the API error on failure", async () => {
      createStudent.mockRejectedValue(new Error("A user with that phone or email already exists."));
      render(<UsersManagement />);

      fireEvent.click(await screen.findByRole("button", { name: "Tambah Siswa" }));
      fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Siti Aminah" } });
      fireEvent.change(screen.getByLabelText("Telepon"), { target: { value: "081234500009" } });
      fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

      expect(
        await screen.findByText("A user with that phone or email already exists."),
      ).toBeInTheDocument();
    });
  });

  describe("Hapus", () => {
    it("requires typing the confirmation word before the delete button is enabled", async () => {
      getUserDetail.mockResolvedValue({ ...makeUser(), bookingCount: 6, transactionCount: 2 });
      render(<UsersManagement />);

      fireEvent.click(await screen.findByText("Andi Wijaya"));
      fireEvent.click(await screen.findByRole("button", { name: "Hapus" }));

      const confirmButton = screen.getByRole("button", { name: "Konfirmasi Hapus" });
      expect(confirmButton).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Ketik "HAPUS" untuk konfirmasi'), {
        target: { value: "salah" },
      });
      expect(confirmButton).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Ketik "HAPUS" untuk konfirmasi'), {
        target: { value: "HAPUS" },
      });
      expect(confirmButton).not.toBeDisabled();

      deleteUser.mockResolvedValue(undefined);
      fireEvent.click(confirmButton);

      await waitFor(() => expect(deleteUser).toHaveBeenCalledWith("u1"));
      expect(searchUsers).toHaveBeenCalledTimes(2);
    });

    it("shows the API error on failure and keeps the detail panel open", async () => {
      getUserDetail.mockResolvedValue({ ...makeUser(), bookingCount: 0, transactionCount: 0 });
      deleteUser.mockRejectedValue(new Error("You cannot delete your own account."));
      render(<UsersManagement />);

      fireEvent.click(await screen.findByText("Andi Wijaya"));
      fireEvent.click(await screen.findByRole("button", { name: "Hapus" }));
      fireEvent.change(screen.getByLabelText('Ketik "HAPUS" untuk konfirmasi'), {
        target: { value: "HAPUS" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Hapus" }));

      expect(
        await screen.findByText("You cannot delete your own account."),
      ).toBeInTheDocument();
    });
  });

  describe("Buat Link Akses", () => {
    it("shows the button only for a STUDENT account", async () => {
      getUserDetail.mockResolvedValue({
        ...makeUser({ role: "TUTOR" }),
        bookingCount: 0,
        transactionCount: 0,
      });
      render(<UsersManagement />);

      fireEvent.click(await screen.findByText("Andi Wijaya"));

      await screen.findByText("TUTOR");
      expect(screen.queryByRole("button", { name: "Buat Link Akses" })).not.toBeInTheDocument();
    });

    it("generates a link, displays it with its expiry, and copies it to the clipboard", async () => {
      getUserDetail.mockResolvedValue({ ...makeUser(), bookingCount: 0, transactionCount: 0 });
      generateAccessLink.mockResolvedValue({
        token: "abc123",
        url: "http://localhost:3000/access/abc123",
      });
      render(<UsersManagement />);

      fireEvent.click(await screen.findByText("Andi Wijaya"));
      fireEvent.click(await screen.findByRole("button", { name: "Buat Link Akses" }));

      await waitFor(() => expect(generateAccessLink).toHaveBeenCalledWith("u1"));
      const linkInput = (await screen.findByLabelText(
        /Link akses/,
      )) as HTMLInputElement;
      expect(linkInput.value).toBe("http://localhost:3000/access/abc123");

      fireEvent.click(screen.getByRole("button", { name: "Salin" }));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "http://localhost:3000/access/abc123",
      );
      expect(await screen.findByRole("button", { name: "Tersalin" })).toBeInTheDocument();
    });

    it("shows the API error on failure", async () => {
      getUserDetail.mockResolvedValue({ ...makeUser(), bookingCount: 0, transactionCount: 0 });
      generateAccessLink.mockRejectedValue(new Error("Access links can only be generated for a STUDENT account."));
      render(<UsersManagement />);

      fireEvent.click(await screen.findByText("Andi Wijaya"));
      fireEvent.click(await screen.findByRole("button", { name: "Buat Link Akses" }));

      expect(
        await screen.findByText("Access links can only be generated for a STUDENT account."),
      ).toBeInTheDocument();
    });
  });
});
