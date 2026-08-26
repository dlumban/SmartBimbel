"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import {
  AdminTransaction,
  getReconciliation,
  listAdminTransactions,
  ReconciliationResult,
} from "../lib/transactions";

function formatIDR(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

const STATUS_BADGE: Record<string, "verified" | "online" | "offline" | "warning"> = {
  PAID: "verified",
  PENDING: "warning",
  FAILED: "offline",
  REFUNDED: "online",
};

function TransactionRow({ t }: { t: AdminTransaction }) {
  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{t.booking.subject.name}</span>
        <Badge variant={STATUS_BADGE[t.status] ?? "neutral"}>{t.status}</Badge>
      </div>
      <p className="text-muted-foreground">
        {t.booking.student.user.name ?? "Siswa"} &rarr; {t.booking.tutor.user.name ?? "Tutor"}
      </p>
      <p className="mt-1 text-foreground">
        {formatIDR(t.amount)} (komisi {formatIDR(t.commission)})
      </p>
      {t.gatewayRef && <p className="text-xs text-muted-foreground">Ref: {t.gatewayRef}</p>}
    </li>
  );
}

/**
 * Transaction list + reconciliation view (Task 7.4) - payout approval
 * itself lives in PayoutsQueue, which is the actual financial-approval
 * action; this screen is read-only for both admin sub-roles.
 */
export function TransactionsView() {
  const [tab, setTab] = useState<"all" | "reconciliation">("all");
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    Promise.all([listAdminTransactions(), getReconciliation()])
      .then(([tx, recon]) => {
        setTransactions(tx.data);
        setReconciliation(recon);
      })
      .catch(() => setLoadError("Gagal memuat data transaksi."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  if (loading) return <LoadingSpinner />;
  if (loadError) return <ErrorState description={loadError} onRetry={refresh} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button variant={tab === "all" ? "primary" : "secondary"} size="sm" onClick={() => setTab("all")}>
          Semua Transaksi
        </Button>
        <Button
          variant={tab === "reconciliation" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTab("reconciliation")}
        >
          Rekonsiliasi {reconciliation && reconciliation.total > 0 ? `(${reconciliation.total})` : ""}
        </Button>
      </div>

      {tab === "all" && (
        <ul className="flex flex-col gap-2">
          {transactions.map((t) => (
            <TransactionRow key={t.id} t={t} />
          ))}
          {transactions.length === 0 && <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>}
        </ul>
      )}

      {tab === "reconciliation" && reconciliation && (
        <div>
          <Card className="mb-4 bg-warning-50">
            <CardContent className="pt-6">
              <p className="text-sm text-warning-700">
                Transaksi berstatus PENDING lebih dari {reconciliation.staleThresholdHours} jam - kemungkinan
                webhook Midtrans tidak sampai atau ada masalah proses pembayaran. Perlu ditinjau manual.
              </p>
            </CardContent>
          </Card>
          <ul className="flex flex-col gap-2">
            {reconciliation.data.map((t) => (
              <TransactionRow key={t.id} t={t} />
            ))}
            {reconciliation.data.length === 0 && (
              <p className="text-sm text-muted-foreground">Tidak ada transaksi yang perlu direkonsiliasi.</p>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
