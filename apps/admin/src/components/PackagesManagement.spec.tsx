import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PackagesManagement } from "./PackagesManagement";

const listPackages = vi.fn();
const createPackage = vi.fn();
const updatePackage = vi.fn();
const setPackageActive = vi.fn();
vi.mock("../lib/packages", async () => {
  const actual = await vi.importActual<typeof import("../lib/packages")>("../lib/packages");
  return {
    ...actual,
    listPackages: () => listPackages(),
    createPackage: (...args: unknown[]) => createPackage(...args),
    updatePackage: (...args: unknown[]) => updatePackage(...args),
    setPackageActive: (...args: unknown[]) => setPackageActive(...args),
  };
});

function makePackage(overrides: Record<string, unknown> = {}) {
  return {
    id: "pkg1",
    name: "Paket Hemat",
    sessionCount: 4,
    durationMinutes: 60,
    totalPrice: 400000,
    isActive: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PackagesManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPackages.mockResolvedValue([makePackage()]);
  });

  it("lists packages from the API", async () => {
    render(<PackagesManagement />);
    expect(await screen.findByText("Paket Hemat")).toBeInTheDocument();
    expect(screen.getByText(/4 sesi/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no packages", async () => {
    listPackages.mockResolvedValue([]);
    render(<PackagesManagement />);
    expect(await screen.findByText("Belum ada paket.")).toBeInTheDocument();
  });

  it("requires a name before creating a package", async () => {
    render(<PackagesManagement />);
    await screen.findByText("Paket Hemat");

    fireEvent.click(screen.getByRole("button", { name: "Tambah Paket" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Nama paket wajib diisi.")).toBeInTheDocument();
    expect(createPackage).not.toHaveBeenCalled();
  });

  it("creates a package and refreshes the list", async () => {
    createPackage.mockResolvedValue(makePackage({ id: "pkg2", name: "Paket Baru" }));
    render(<PackagesManagement />);
    await screen.findByText("Paket Hemat");

    fireEvent.click(screen.getByRole("button", { name: "Tambah Paket" }));
    fireEvent.change(screen.getByLabelText("Nama paket"), { target: { value: "Paket Baru" } });
    fireEvent.change(screen.getByLabelText("Jumlah sesi"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Durasi per sesi (menit)"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Total harga (Rp)"), { target: { value: "900000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(createPackage).toHaveBeenCalledWith({
        name: "Paket Baru",
        sessionCount: 8,
        durationMinutes: 90,
        totalPrice: 900000,
      }),
    );
    expect(listPackages).toHaveBeenCalledTimes(2);
  });

  it("shows the API error on create failure", async () => {
    createPackage.mockRejectedValue(new Error("Nama paket sudah digunakan."));
    render(<PackagesManagement />);
    await screen.findByText("Paket Hemat");

    fireEvent.click(screen.getByRole("button", { name: "Tambah Paket" }));
    fireEvent.change(screen.getByLabelText("Nama paket"), { target: { value: "Paket Baru" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Nama paket sudah digunakan.")).toBeInTheDocument();
  });

  it("prefills the form and updates an existing package", async () => {
    updatePackage.mockResolvedValue(makePackage({ name: "Paket Hemat Plus" }));
    render(<PackagesManagement />);
    await screen.findByText("Paket Hemat");

    fireEvent.click(screen.getByRole("button", { name: "Ubah" }));
    expect(screen.getByLabelText("Nama paket")).toHaveValue("Paket Hemat");

    fireEvent.change(screen.getByLabelText("Nama paket"), { target: { value: "Paket Hemat Plus" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(updatePackage).toHaveBeenCalledWith("pkg1", {
        name: "Paket Hemat Plus",
        sessionCount: 4,
        durationMinutes: 60,
        totalPrice: 400000,
      }),
    );
    expect(listPackages).toHaveBeenCalledTimes(2);
  });

  it("deactivates an active package", async () => {
    setPackageActive.mockResolvedValue(makePackage({ isActive: false }));
    render(<PackagesManagement />);
    await screen.findByText("Paket Hemat");

    fireEvent.click(screen.getByRole("button", { name: "Nonaktifkan" }));

    await waitFor(() => expect(setPackageActive).toHaveBeenCalledWith("pkg1", false));
    expect(listPackages).toHaveBeenCalledTimes(2);
  });

  it("reactivates an inactive package", async () => {
    listPackages.mockResolvedValue([makePackage({ isActive: false })]);
    setPackageActive.mockResolvedValue(makePackage({ isActive: true }));
    render(<PackagesManagement />);
    await screen.findByText("Paket Hemat");

    fireEvent.click(screen.getByRole("button", { name: "Aktifkan" }));

    await waitFor(() => expect(setPackageActive).toHaveBeenCalledWith("pkg1", true));
  });
});
