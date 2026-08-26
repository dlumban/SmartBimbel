"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../hooks/useAuth";
import { AdminPayout, listPendingPayouts, updatePayoutStatus } from "../lib/payouts";

function formatIDR(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

const NEXT_ACTION: Record<string, { label: string; next: "PROCESSING" | "COMPLETED" } | null> = {
  PENDING: { label: "Proses", next: "PROCESSING" },
  PROCESSING: { label: "Tandai Selesai", next: "COMPLETED" },
  COMPLETED: null,
  FAILED: null,
};

/**
 * Payout approval queue (Task 7.4) - Super-Admin-only per PRD §5's
 * "financial approval rights" split; a Support admin can still see this
 * page (read access), but the action buttons are hidden and the server
 * would reject the call anyway (AdminRoleGuard).
 */
export function PayoutsQueue() {
  const { sessionUser } = useAuth();
  const isSuperAdmin = sessionUser?.adminRole === "SUPER_ADMIN";

  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failingId, setFailingId] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    listPendingPayouts()
      .then(setPayouts)
      .catch(() => setLoadError("Gagal memuat antrean pencairan dana."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  async function handleAdvance(payout: AdminPayout) {
    const action = NEXT_ACTION[payout.status];
    if (!action) return;
    setSubmittingId(payout.id);
    setActionError(null);
    try {
      await updatePayoutStatus(payout.id, { status: action.next });
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal memperbarui status.");
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleFail(payout: AdminPayout) {
    if (!failureReason.trim()) {
      setActionError("Alasan kegagalan wajib diisi.");
      return;
    }
    setSubmittingId(payout.id);
    setActionError(null);
    try {
      await updatePayoutStatus(payout.id, { status: "FAILED", failureReason });
      setFailingId(null);
      setFailureReason("");
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal memperbarui status.");
    } finally {
      setSubmittingId(null);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (loadError) return <ErrorState description={loadError} onRetry={refresh} />;

  return (
    <div className="flex flex-col gap-3">
      {!isSuperAdmin && (
        <p className="rounded-md bg-warning-50 p-3 text-sm text-warning-700">
          Hanya Super Admin yang dapat memproses pencairan dana. Anda dapat melihat antrean ini.
        </p>
      )}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      {payouts.map((p) => (
        <Card key={p.id}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{p.tutor.user.name ?? "Tutor"}</span>
              <Badge variant="warning">{p.status}</Badge>
            </div>
            <p className="mt-1 text-lg font-semibold">{formatIDR(p.amount)}</p>
            <p className="text-sm text-muted-foreground">
              {p.bankName} &middot; {p.bankAccountNumber} a.n. {p.bankAccountHolderName}
            </p>

            {isSuperAdmin && (
              <div className="mt-3 flex flex-wrap gap-2">
                {NEXT_ACTION[p.status] && (
                  <Button
                    size="sm"
                    disabled={submittingId === p.id}
                    onClick={() => handleAdvance(p)}
                  >
                    {NEXT_ACTION[p.status]!.label}
                  </Button>
                )}
                {p.status !== "COMPLETED" && p.status !== "FAILED" && (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={submittingId === p.id}
                    onClick={() => setFailingId(failingId === p.id ? null : p.id)}
                  >
                    Tandai Gagal
                  </Button>
                )}
              </div>
            )}

            {failingId === p.id && (
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  rows={2}
                  placeholder="Alasan kegagalan"
                  className="rounded-md border border-input p-2 text-sm"
                />
                <Button size="sm" variant="danger" disabled={submittingId === p.id} onClick={() => handleFail(p)}>
                  Konfirmasi Gagal
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {payouts.length === 0 && (
        <p className="text-sm text-muted-foreground">Tidak ada permintaan pencairan dana yang menunggu.</p>
      )}
    </div>
  );
}
