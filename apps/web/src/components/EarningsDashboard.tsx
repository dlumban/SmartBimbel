"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, ErrorState, Input, LoadingSpinner } from "@smartbimbel/ui";
import { downloadEarningsCsv, EarningsSummary, getEarningsSummary } from "../lib/earnings";
import { PAYOUT_STATUS_LABELS, requestPayout, setBankDetails } from "../lib/payouts";

const PAYOUT_STATUS_BADGE: Record<string, "verified" | "online" | "offline" | "warning"> = {
  PENDING: "warning",
  PROCESSING: "online",
  COMPLETED: "verified",
  FAILED: "offline",
};

function formatIDR(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

/**
 * Tutor earnings dashboard (Task 5.4) plus bank details + payout request
 * (Task 5.5) - the admin-side processing view is out of scope here (that's
 * Sprint 7, Task 7.4); this only ever calls the tutor-facing endpoints.
 */
export function EarningsDashboard() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountHolderName, setBankAccountHolderName] = useState("");
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankSaved, setBankSaved] = useState(false);

  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    getEarningsSummary()
      .then(setSummary)
      .catch(() => setLoadError("Gagal memuat data pendapatan."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  async function handleSaveBankDetails() {
    setBankError(null);
    setBankSaved(false);
    if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountHolderName.trim()) {
      setBankError("Lengkapi semua kolom detail rekening.");
      return;
    }
    setBankSubmitting(true);
    try {
      await setBankDetails({ bankName, bankAccountNumber, bankAccountHolderName });
      setBankSaved(true);
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Gagal menyimpan detail rekening.");
    } finally {
      setBankSubmitting(false);
    }
  }

  async function handleRequestPayout() {
    setPayoutError(null);
    setPayoutSuccess(null);
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayoutError("Masukkan jumlah penarikan yang valid.");
      return;
    }
    setPayoutSubmitting(true);
    try {
      await requestPayout(amount);
      setPayoutSuccess("Permintaan penarikan dana telah dikirim.");
      setPayoutAmount("");
      refresh();
    } catch (e) {
      setPayoutError(e instanceof Error ? e.message : "Gagal mengajukan penarikan dana.");
    } finally {
      setPayoutSubmitting(false);
    }
  }

  async function handleExport() {
    setExportError(null);
    setExporting(true);
    try {
      await downloadEarningsCsv({ from: exportFrom || undefined, to: exportTo || undefined });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Gagal mengunduh riwayat.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (loadError || !summary) {
    return <ErrorState description={loadError ?? "Data tidak ditemukan."} onRetry={refresh} />;
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Saldo Tersedia</p>
            <p className="mt-1 text-xl font-semibold text-success-700">
              {formatIDR(summary.availableBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Saldo Tertunda</p>
            <p className="mt-1 text-xl font-semibold text-warning-700">
              {formatIDR(summary.pendingBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Pendapatan</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {formatIDR(summary.totalEarned)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold">Detail Rekening Bank</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="Nama Bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="BCA"
            />
            <Input
              label="Nomor Rekening"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="1234567890"
            />
            <Input
              label="Nama Pemilik Rekening"
              value={bankAccountHolderName}
              onChange={(e) => setBankAccountHolderName(e.target.value)}
              placeholder="Sesuai buku tabungan"
            />
            {bankError && <p className="text-sm text-destructive">{bankError}</p>}
            {bankSaved && <p className="text-sm text-success-700">Detail rekening tersimpan.</p>}
            <Button disabled={bankSubmitting} onClick={handleSaveBankDetails}>
              Simpan Detail Rekening
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold">Tarik Dana</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="Jumlah (IDR)"
              type="number"
              min={1}
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              placeholder="100000"
            />
            {payoutError && <p className="text-sm text-destructive">{payoutError}</p>}
            {payoutSuccess && <p className="text-sm text-success-700">{payoutSuccess}</p>}
            <Button disabled={payoutSubmitting} onClick={handleRequestPayout}>
              Ajukan Penarikan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Riwayat Transaksi</h2>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                label="Dari"
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
              />
              <Input
                label="Sampai"
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
              />
              <Button size="sm" variant="secondary" disabled={exporting} onClick={handleExport}>
                Unduh CSV
              </Button>
            </div>
          </div>
          {exportError && <p className="mb-2 text-sm text-destructive">{exportError}</p>}

          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Riwayat Penarikan</h3>
          {summary.payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada penarikan dana.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {summary.payouts.map((payout) => (
                <li
                  key={payout.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{formatIDR(payout.amount)}</p>
                    <p className="text-muted-foreground">
                      {new Date(payout.createdAt).toLocaleDateString("id-ID")}
                    </p>
                    {payout.status === "FAILED" && payout.failureReason && (
                      <p className="text-destructive">{payout.failureReason}</p>
                    )}
                  </div>
                  <Badge variant={PAYOUT_STATUS_BADGE[payout.status]}>
                    {PAYOUT_STATUS_LABELS[payout.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
