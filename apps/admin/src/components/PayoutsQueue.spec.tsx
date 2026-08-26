import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PayoutsQueue } from "./PayoutsQueue";

const listPendingPayouts = vi.fn();
const updatePayoutStatus = vi.fn();
vi.mock("../lib/payouts", async () => {
  const actual = await vi.importActual<typeof import("../lib/payouts")>("../lib/payouts");
  return {
    ...actual,
    listPendingPayouts: (...args: unknown[]) => listPendingPayouts(...args),
    updatePayoutStatus: (...args: unknown[]) => updatePayoutStatus(...args),
  };
});

let sessionUser: { adminRole: string | null } | null = { adminRole: "SUPER_ADMIN" };
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ sessionUser }),
}));

function makePayout(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    amount: 200000,
    status: "PENDING",
    bankName: "BCA",
    bankAccountNumber: "12345",
    bankAccountHolderName: "Budi",
    failureReason: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    tutor: { user: { name: "Budi Santoso", email: "budi@example.com" } },
    ...overrides,
  };
}

describe("PayoutsQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { adminRole: "SUPER_ADMIN" };
  });

  it("lists pending payouts", async () => {
    listPendingPayouts.mockResolvedValue([makePayout()]);
    render(<PayoutsQueue />);
    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Rp200.000")).toBeInTheDocument();
  });

  it("advances a PENDING payout to PROCESSING", async () => {
    listPendingPayouts.mockResolvedValue([makePayout()]);
    updatePayoutStatus.mockResolvedValue(makePayout({ status: "PROCESSING" }));
    render(<PayoutsQueue />);

    fireEvent.click(await screen.findByRole("button", { name: "Proses" }));

    await waitFor(() =>
      expect(updatePayoutStatus).toHaveBeenCalledWith("p1", { status: "PROCESSING" }),
    );
  });

  it("marks a payout failed with a required reason", async () => {
    listPendingPayouts.mockResolvedValue([makePayout()]);
    updatePayoutStatus.mockResolvedValue(makePayout({ status: "FAILED" }));
    render(<PayoutsQueue />);

    fireEvent.click(await screen.findByRole("button", { name: "Tandai Gagal" }));
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Gagal" }));

    expect(await screen.findByText("Alasan kegagalan wajib diisi.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Alasan kegagalan"), {
      target: { value: "Nomor rekening tidak valid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Gagal" }));

    await waitFor(() =>
      expect(updatePayoutStatus).toHaveBeenCalledWith("p1", {
        status: "FAILED",
        failureReason: "Nomor rekening tidak valid",
      }),
    );
  });

  it("hides action buttons and shows a notice for a Support admin", async () => {
    sessionUser = { adminRole: "SUPPORT" };
    listPendingPayouts.mockResolvedValue([makePayout()]);
    render(<PayoutsQueue />);

    await screen.findByText("Budi Santoso");

    expect(screen.getByText(/Hanya Super Admin/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Proses" })).not.toBeInTheDocument();
  });
});
