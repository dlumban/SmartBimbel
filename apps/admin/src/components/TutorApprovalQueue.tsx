"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import {
  getTutorDocumentUrl,
  listPendingTutors,
  PendingTutor,
  verifyTutor,
} from "../lib/tutors";

/**
 * Tutor approval queue (Task 7.2) - replaces the Task 1.6 Prisma-Studio
 * stopgap. Approving/rejecting immediately updates verificationStatus,
 * which Sprint 2's search already filters on, so a newly-verified tutor
 * shows up in discovery right away with no extra wiring needed here.
 */
export function TutorApprovalQueue() {
  const [tutors, setTutors] = useState<PendingTutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});

  function refresh() {
    setLoading(true);
    setLoadError(null);
    listPendingTutors()
      .then(setTutors)
      .catch(() => setLoadError("Gagal memuat antrean tutor."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  const selected = tutors.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const urls: Record<string, string> = {};
    Promise.all(
      (["ktp", "diploma"] as const).map(async (type) => {
        const path = type === "ktp" ? selected.ktpDocumentPath : selected.diplomaDocumentPath;
        if (!path) return;
        try {
          urls[type] = await getTutorDocumentUrl(selected.id, type);
        } catch {
          // Document fetch failure shouldn't block reviewing the rest of
          // the profile - just leave that document's link absent.
        }
      }),
    ).then(() => {
      if (!cancelled) setDocumentUrls(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function handleApprove() {
    if (!selected) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await verifyTutor(selected.id, { status: "VERIFIED" });
      setSelectedId(null);
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menyetujui tutor.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (!selected || !reason.trim()) {
      setActionError("Alasan penolakan wajib diisi.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await verifyTutor(selected.id, { status: "REJECTED", reason });
      setSelectedId(null);
      setRejecting(false);
      setReason("");
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menolak tutor.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (loadError) return <ErrorState description={loadError} onRetry={refresh} />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Menunggu Persetujuan ({tutors.length})
        </h2>
        {tutors.length === 0 && (
          <p className="text-sm text-muted-foreground">Tidak ada tutor yang menunggu.</p>
        )}
        {tutors.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setSelectedId(t.id);
              setRejecting(false);
              setActionError(null);
            }}
            className={`rounded-lg border p-3 text-left text-sm ${
              selectedId === t.id
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-muted"
            }`}
          >
            <p className="font-medium text-foreground">{t.user.name ?? "Tanpa nama"}</p>
            <p className="text-muted-foreground">
              {t.city ?? "-"} &middot; {t.subjects.map((s) => s.name).join(", ") || "-"}
            </p>
          </button>
        ))}
      </div>

      <div>
        {!selected ? (
          <p className="text-sm text-muted-foreground">Pilih tutor untuk meninjau profil.</p>
        ) : (
          <Card>
            <CardContent className="pt-6">
            <h2 className="text-lg font-semibold">{selected.user.name ?? "Tanpa nama"}</h2>
            <p className="text-sm text-muted-foreground">
              {selected.user.email} &middot; {selected.user.phone}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Pendidikan</dt>
                <dd>{selected.education ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Kota</dt>
                <dd>{selected.city ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tarif per jam</dt>
                <dd>{selected.hourlyRate ? `Rp${selected.hourlyRate.toLocaleString("id-ID")}` : "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Jenjang</dt>
                <dd>{selected.gradeLevels.map((g) => g.name).join(", ") || "-"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-foreground">{selected.bio}</p>

            <div className="mt-4 flex gap-2">
              {(["ktp", "diploma"] as const).map((type) => (
                <div key={type}>
                  {documentUrls[type] ? (
                    <a
                      href={documentUrls[type]}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Lihat {type === "ktp" ? "KTP" : "Ijazah"}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {type === "ktp" ? "KTP" : "Ijazah"} tidak tersedia
                    </span>
                  )}
                </div>
              ))}
            </div>

            {actionError && <p className="mt-3 text-sm text-destructive">{actionError}</p>}

            {!rejecting ? (
              <div className="mt-4 flex gap-2">
                <Button disabled={submitting} onClick={handleApprove}>
                  Setujui
                </Button>
                <Button variant="danger" disabled={submitting} onClick={() => setRejecting(true)}>
                  Tolak
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="reject-reason">
                  Alasan penolakan
                </label>
                <textarea
                  id="reject-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="rounded-md border border-input p-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button variant="danger" disabled={submitting} onClick={handleReject}>
                    Konfirmasi Tolak
                  </Button>
                  <Button variant="ghost" disabled={submitting} onClick={() => setRejecting(false)}>
                    Batal
                  </Button>
                </div>
              </div>
            )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
