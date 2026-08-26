"use client";

import { useState } from "react";
import { Badge, Button, Card, CardContent } from "@smartbimbel/ui";
import {
  ADMIN_BOOKING_STATUS_LABELS,
  AdminBookingDetail,
  overrideCancelBooking,
} from "../lib/bookings";
import { sanitizeHtml } from "../lib/sanitizeHtml";

const TERMINAL_STATUSES = ["DECLINED", "EXPIRED", "CANCELLED", "COMPLETED"];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function NotesBlock({ html }: { html: string }) {
  if (looksLikeHtml(html)) {
    return (
      <div
        className="session-notes-prose text-sm text-foreground"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    );
  }
  return <p className="whitespace-pre-wrap text-sm text-foreground">{html}</p>;
}

/**
 * Read-only admin booking detail - notes, meeting info, session report,
 * review, history, plus Super-Admin force-cancel.
 */
export function AdminBookingDetailPanel({
  detail,
  isSuperAdmin,
  onUpdated,
}: {
  detail: AdminBookingDetail;
  isSuperAdmin: boolean;
  onUpdated?: () => void;
}) {
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleOverride() {
    if (!overrideReason.trim()) {
      setActionError("Alasan pembatalan wajib diisi.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
        await overrideCancelBooking(detail.id, overrideReason);
      setOverrideReason("");
      setShowOverrideForm(false);
      onUpdated?.();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal membatalkan booking.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{detail.subject.name}</h2>
          <Badge variant="neutral">
            {ADMIN_BOOKING_STATUS_LABELS[detail.status] ?? detail.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(detail.scheduledAt)} &middot; {detail.durationMinutes} menit &middot;{" "}
          {detail.mode === "ONLINE" ? "Online" : "Tatap muka"}
        </p>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Siswa</dt>
            <dd>{detail.student.user.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tutor</dt>
            <dd>{detail.tutor.user.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kota tutor</dt>
            <dd>{detail.tutor.city ?? "-"}</dd>
          </div>
          {detail.transaction && (
            <div>
              <dt className="text-muted-foreground">Transaksi</dt>
              <dd>
                {detail.transaction.status} &middot; Rp
                {detail.transaction.amount.toLocaleString("id-ID")}
              </dd>
            </div>
          )}
        </dl>

        {detail.notes && (
          <section>
            <h3 className="text-sm font-semibold">Catatan booking</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{detail.notes}</p>
          </section>
        )}

        {(detail.meetingLink || detail.meetingAddress) && (
          <section>
            <h3 className="text-sm font-semibold">Pertemuan</h3>
            {detail.meetingLink && (
              <a
                href={detail.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-sm text-primary hover:underline"
              >
                {detail.meetingLink}
              </a>
            )}
            {detail.meetingAddress && (
              <p className="mt-1 text-sm text-muted-foreground">{detail.meetingAddress}</p>
            )}
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold">Laporan / Catatan Sesi</h3>
          {detail.sessionNotes ? (
            <div className="mt-1 rounded-md border border-border bg-muted/40 p-3">
              <NotesBlock html={detail.sessionNotes} />
              {detail.sessionNotesUpdatedAt && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Diperbarui: {formatDateTime(detail.sessionNotesUpdatedAt)}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Belum ada catatan sesi.</p>
          )}
        </section>

        {detail.review && (
          <section>
            <h3 className="text-sm font-semibold">Ulasan siswa</h3>
            <p className="mt-1 text-sm">
              Rating: {detail.review.rating}/5
              {detail.review.flagged ? " · Ditandai" : ""}
            </p>
            {detail.review.text && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {detail.review.text}
              </p>
            )}
          </section>
        )}

        {(detail.declineReason || detail.cancellationReason || detail.noShowReported) && (
          <section className="text-sm">
            {detail.declineReason && (
              <p>
                <span className="text-muted-foreground">Alasan tolak: </span>
                {detail.declineReason}
              </p>
            )}
            {detail.cancellationReason && (
              <p>
                <span className="text-muted-foreground">Alasan batal: </span>
                {detail.cancellationReason}
                {detail.isLateCancellation ? " (terlambat)" : ""}
              </p>
            )}
            {detail.noShowReported && (
              <p className="text-destructive">Sesi dilaporkan tidak dihadiri.</p>
            )}
          </section>
        )}

        {detail.statusHistory?.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold">Riwayat</h3>
            <ul className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
              {detail.statusHistory.map((h) => (
                <li key={h.id}>
                  {ADMIN_BOOKING_STATUS_LABELS[h.toStatus] ?? h.toStatus} &middot;{" "}
                  {formatDateTime(h.createdAt)}
                  {h.reason ? ` — ${h.reason}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        {isSuperAdmin && !TERMINAL_STATUSES.includes(detail.status) && (
          <div>
            {!showOverrideForm ? (
              <Button variant="danger" disabled={submitting} onClick={() => setShowOverrideForm(true)}>
                Batalkan Paksa (Admin Override)
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="override-reason">
                  Alasan pembatalan paksa
                </label>
                <textarea
                  id="override-reason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  className="rounded-md border border-input p-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button variant="danger" disabled={submitting} onClick={handleOverride}>
                    Konfirmasi Pembatalan
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={submitting}
                    onClick={() => setShowOverrideForm(false)}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
