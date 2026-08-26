"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { AdminDispute, listOpenDisputes, listReports, MessageReportItem, resolveDispute } from "../lib/disputes";

function ageLabel(createdAt: string): string {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / (60 * 60 * 1000));
  if (hours < 1) return "Baru saja dibuka";
  if (hours < 24) return `Terbuka ${hours} jam`;
  return `Terbuka ${Math.floor(hours / 24)} hari`;
}

/**
 * Dispute resolution tools (Task 7.5) - full context (both parties,
 * booking status, no-show flag, linked transaction) plus SLA age, so
 * support staff never need to query the database directly. Reported chat
 * content from Sprint 4 is surfaced in a second tab, since a report isn't
 * always tied to a formal dispute.
 */
export function DisputesQueue() {
  const [tab, setTab] = useState<"disputes" | "reports">("disputes");
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [reports, setReports] = useState<MessageReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    Promise.all([listOpenDisputes(), listReports()])
      .then(([d, r]) => {
        setDisputes(d);
        setReports(r);
      })
      .catch(() => setLoadError("Gagal memuat data sengketa."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  async function handleResolve(id: string, status: "RESOLVED_REFUND" | "RESOLVED_NO_REFUND") {
    setSubmitting(true);
    setActionError(null);
    try {
      await resolveDispute(id, { status, resolutionNotes: notes || undefined });
      setResolvingId(null);
      setNotes("");
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menyelesaikan sengketa.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (loadError) return <ErrorState description={loadError} onRetry={refresh} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          variant={tab === "disputes" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTab("disputes")}
        >
          Sengketa ({disputes.length})
        </Button>
        <Button
          variant={tab === "reports" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTab("reports")}
        >
          Laporan Obrolan ({reports.length})
        </Button>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {tab === "disputes" && (
        <div className="flex flex-col gap-3">
          {disputes.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {d.booking.student.user.name ?? "Siswa"} vs {d.booking.tutor.user.name ?? "Tutor"}
                  </span>
                  <Badge variant="warning">{ageLabel(d.createdAt)}</Badge>
                </div>
                <p className="mt-1 text-sm text-foreground">{d.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status booking: {d.booking.status}
                  {d.booking.noShowReported && " · Tidak hadir dilaporkan"}
                  {d.booking.transaction && ` · Transaksi: ${d.booking.transaction.status}`}
                </p>

                {resolvingId !== d.id ? (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => setResolvingId(d.id)}>
                      Selesaikan
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Catatan penyelesaian (opsional)"
                      className="rounded-md border border-input p-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={submitting}
                        onClick={() => handleResolve(d.id, "RESOLVED_REFUND")}
                      >
                        Selesaikan + Refund
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={submitting}
                        onClick={() => handleResolve(d.id, "RESOLVED_NO_REFUND")}
                      >
                        Selesaikan Tanpa Refund
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={submitting}
                        onClick={() => setResolvingId(null)}
                      >
                        Batal
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {disputes.length === 0 && (
            <p className="text-sm text-muted-foreground">Tidak ada sengketa yang terbuka.</p>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-6">
                <p className="text-sm">
                  <span className="font-medium">{r.reporter.name ?? "Pengguna"}</span> melaporkan{" "}
                  <span className="font-medium">{r.reportedUser.name ?? "pengguna lain"}</span>
                </p>
                <p className="mt-1 text-sm text-foreground">{r.reason}</p>
                {r.message && (
                  <p className="mt-1 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    &ldquo;{r.message.body}&rdquo;
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Booking: {r.conversation.bookingId} &middot;{" "}
                  {new Date(r.createdAt).toLocaleString("id-ID")}
                </p>
              </CardContent>
            </Card>
          ))}
          {reports.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada laporan.</p>
          )}
        </div>
      )}
    </div>
  );
}
