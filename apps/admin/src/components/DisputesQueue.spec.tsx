import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DisputesQueue } from "./DisputesQueue";

const listOpenDisputes = vi.fn();
const listReports = vi.fn();
const resolveDispute = vi.fn();
vi.mock("../lib/disputes", async () => {
  const actual = await vi.importActual<typeof import("../lib/disputes")>("../lib/disputes");
  return {
    ...actual,
    listOpenDisputes: (...args: unknown[]) => listOpenDisputes(...args),
    listReports: (...args: unknown[]) => listReports(...args),
    resolveDispute: (...args: unknown[]) => resolveDispute(...args),
  };
});

function makeDispute(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1",
    bookingId: "b1",
    reason: "Tutor tidak hadir",
    status: "OPEN",
    resolutionNotes: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    booking: {
      id: "b1",
      status: "CONFIRMED",
      noShowReported: true,
      student: { user: { name: "Andi" } },
      tutor: { user: { name: "Budi" } },
      transaction: { status: "PAID", amount: 100000 },
    },
    ...overrides,
  };
}

describe("DisputesQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listReports.mockResolvedValue([]);
  });

  it("lists open disputes with context", async () => {
    listOpenDisputes.mockResolvedValue([makeDispute()]);
    render(<DisputesQueue />);

    expect(await screen.findByText(/Andi vs Budi/)).toBeInTheDocument();
    expect(screen.getByText("Tutor tidak hadir")).toBeInTheDocument();
    expect(screen.getByText(/Tidak hadir dilaporkan/)).toBeInTheDocument();
  });

  it("resolves a dispute with refund", async () => {
    listOpenDisputes.mockResolvedValue([makeDispute()]);
    resolveDispute.mockResolvedValue(makeDispute({ status: "RESOLVED_REFUND" }));
    render(<DisputesQueue />);

    fireEvent.click(await screen.findByRole("button", { name: "Selesaikan" }));
    fireEvent.click(screen.getByRole("button", { name: "Selesaikan + Refund" }));

    await waitFor(() =>
      expect(resolveDispute).toHaveBeenCalledWith("d1", {
        status: "RESOLVED_REFUND",
        resolutionNotes: undefined,
      }),
    );
  });

  it("switches to the reports tab and shows a reported message", async () => {
    listOpenDisputes.mockResolvedValue([]);
    listReports.mockResolvedValue([
      {
        id: "r1",
        reason: "Meminta pembayaran di luar platform",
        createdAt: "2026-08-01T00:00:00.000Z",
        reporter: { id: "u1", name: "Andi" },
        reportedUser: { id: "u2", name: "Budi" },
        message: { id: "m1", body: "Transfer ke rekening pribadi ya" },
        conversation: { bookingId: "b1" },
      },
    ]);
    render(<DisputesQueue />);

    fireEvent.click(await screen.findByRole("button", { name: /Laporan Obrolan/ }));

    expect(await screen.findByText("Meminta pembayaran di luar platform")).toBeInTheDocument();
    expect(screen.getByText(/Transfer ke rekening pribadi ya/)).toBeInTheDocument();
  });
});
