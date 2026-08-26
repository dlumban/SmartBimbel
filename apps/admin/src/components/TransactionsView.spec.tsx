import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TransactionsView } from "./TransactionsView";

const listAdminTransactions = vi.fn();
const getReconciliation = vi.fn();
vi.mock("../lib/transactions", async () => {
  const actual = await vi.importActual<typeof import("../lib/transactions")>("../lib/transactions");
  return {
    ...actual,
    listAdminTransactions: (...args: unknown[]) => listAdminTransactions(...args),
    getReconciliation: (...args: unknown[]) => getReconciliation(...args),
  };
});

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: "tx1",
    amount: 100000,
    commission: 15000,
    gatewayRef: "gw-1",
    refundedAmount: null,
    status: "PAID",
    paidAt: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    booking: {
      id: "b1",
      subject: { name: "Matematika" },
      student: { user: { name: "Andi" } },
      tutor: { user: { name: "Budi" } },
    },
    ...overrides,
  };
}

describe("TransactionsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists all transactions by default", async () => {
    listAdminTransactions.mockResolvedValue({ data: [makeTransaction()], total: 1, page: 1, limit: 20 });
    getReconciliation.mockResolvedValue({ data: [], total: 0, staleThresholdHours: 24 });

    render(<TransactionsView />);

    expect(await screen.findByText("Matematika")).toBeInTheDocument();
    expect(screen.getByText("Rp100.000 (komisi Rp15.000)")).toBeInTheDocument();
  });

  it("switches to the reconciliation tab and shows stale transactions", async () => {
    listAdminTransactions.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    getReconciliation.mockResolvedValue({
      data: [makeTransaction({ status: "PENDING" })],
      total: 1,
      staleThresholdHours: 24,
    });

    render(<TransactionsView />);

    fireEvent.click(await screen.findByRole("button", { name: /Rekonsiliasi/ }));

    expect(await screen.findByText("Matematika")).toBeInTheDocument();
    expect(screen.getByText(/lebih dari 24 jam/)).toBeInTheDocument();
  });
});
