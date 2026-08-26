import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { EarningsDashboard } from "./EarningsDashboard";

const getEarningsSummary = vi.fn();
const downloadEarningsCsv = vi.fn();
vi.mock("../lib/earnings", async () => {
  const actual = await vi.importActual<typeof import("../lib/earnings")>("../lib/earnings");
  return {
    ...actual,
    getEarningsSummary: (...args: unknown[]) => getEarningsSummary(...args),
    downloadEarningsCsv: (...args: unknown[]) => downloadEarningsCsv(...args),
  };
});

const setBankDetails = vi.fn();
const requestPayout = vi.fn();
vi.mock("../lib/payouts", async () => {
  const actual = await vi.importActual<typeof import("../lib/payouts")>("../lib/payouts");
  return {
    ...actual,
    setBankDetails: (...args: unknown[]) => setBankDetails(...args),
    requestPayout: (...args: unknown[]) => requestPayout(...args),
  };
});

function makeSummary(overrides: Record<string, unknown> = {}) {
  return {
    totalEarned: 500000,
    availableBalance: 300000,
    pendingBalance: 200000,
    payouts: [],
    ...overrides,
  };
}

describe("EarningsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEarningsSummary.mockResolvedValue(makeSummary());
  });

  it("shows the available/pending/total balance cards", async () => {
    render(<EarningsDashboard />);

    expect(await screen.findByText("Rp300.000")).toBeInTheDocument();
    expect(screen.getByText("Rp200.000")).toBeInTheDocument();
    expect(screen.getByText("Rp500.000")).toBeInTheDocument();
  });

  it("shows an error state with retry when loading fails", async () => {
    getEarningsSummary.mockReset();
    getEarningsSummary.mockRejectedValueOnce(new Error("network error"));
    getEarningsSummary.mockResolvedValueOnce(makeSummary());

    render(<EarningsDashboard />);

    expect(await screen.findByText("Gagal memuat data pendapatan.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /coba lagi/i }));

    expect(await screen.findByText("Rp300.000")).toBeInTheDocument();
  });

  it("saves bank details", async () => {
    setBankDetails.mockResolvedValue({});
    render(<EarningsDashboard />);
    await screen.findByText("Rp300.000");

    fireEvent.change(screen.getByLabelText("Nama Bank"), { target: { value: "BCA" } });
    fireEvent.change(screen.getByLabelText("Nomor Rekening"), { target: { value: "12345" } });
    fireEvent.change(screen.getByLabelText("Nama Pemilik Rekening"), {
      target: { value: "Budi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Detail Rekening" }));

    await waitFor(() =>
      expect(setBankDetails).toHaveBeenCalledWith({
        bankName: "BCA",
        bankAccountNumber: "12345",
        bankAccountHolderName: "Budi",
      }),
    );
    expect(await screen.findByText("Detail rekening tersimpan.")).toBeInTheDocument();
  });

  it("rejects saving incomplete bank details before calling the API", async () => {
    render(<EarningsDashboard />);
    await screen.findByText("Rp300.000");

    fireEvent.click(screen.getByRole("button", { name: "Simpan Detail Rekening" }));

    expect(await screen.findByText("Lengkapi semua kolom detail rekening.")).toBeInTheDocument();
    expect(setBankDetails).not.toHaveBeenCalled();
  });

  it("requests a payout and refreshes the summary", async () => {
    requestPayout.mockResolvedValue({ id: "p1", status: "PENDING" });
    render(<EarningsDashboard />);
    await screen.findByText("Rp300.000");

    fireEvent.change(screen.getByLabelText("Jumlah (IDR)"), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajukan Penarikan" }));

    await waitFor(() => expect(requestPayout).toHaveBeenCalledWith(100000));
    expect(
      await screen.findByText("Permintaan penarikan dana telah dikirim."),
    ).toBeInTheDocument();
    expect(getEarningsSummary).toHaveBeenCalledTimes(2);
  });

  it("rejects an invalid payout amount before calling the API", async () => {
    render(<EarningsDashboard />);
    await screen.findByText("Rp300.000");

    fireEvent.click(screen.getByRole("button", { name: "Ajukan Penarikan" }));

    expect(
      await screen.findByText("Masukkan jumlah penarikan yang valid."),
    ).toBeInTheDocument();
    expect(requestPayout).not.toHaveBeenCalled();
  });

  it("shows the API's error message when a payout request is rejected", async () => {
    requestPayout.mockRejectedValue(new Error("Requested amount exceeds your available balance."));
    render(<EarningsDashboard />);
    await screen.findByText("Rp300.000");

    fireEvent.change(screen.getByLabelText("Jumlah (IDR)"), { target: { value: "999999999" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajukan Penarikan" }));

    expect(
      await screen.findByText("Requested amount exceeds your available balance."),
    ).toBeInTheDocument();
  });

  it("renders payout history with status labels", async () => {
    getEarningsSummary.mockReset();
    getEarningsSummary.mockResolvedValue(
      makeSummary({
        payouts: [
          {
            id: "p1",
            amount: 150000,
            status: "FAILED",
            failureReason: "Nomor rekening tidak valid",
            createdAt: "2026-08-10T00:00:00.000Z",
          },
        ],
      }),
    );

    render(<EarningsDashboard />);

    expect(await screen.findByText("Rp150.000")).toBeInTheDocument();
    expect(screen.getByText("Gagal")).toBeInTheDocument();
    expect(screen.getByText("Nomor rekening tidak valid")).toBeInTheDocument();
  });

  it("downloads a CSV with the selected date range", async () => {
    downloadEarningsCsv.mockResolvedValue(undefined);
    render(<EarningsDashboard />);
    await screen.findByText("Rp300.000");

    fireEvent.change(screen.getByLabelText("Dari"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("Sampai"), { target: { value: "2026-08-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Unduh CSV" }));

    await waitFor(() =>
      expect(downloadEarningsCsv).toHaveBeenCalledWith({ from: "2026-08-01", to: "2026-08-10" }),
    );
  });
});
