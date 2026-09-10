"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { AllowedBookingDurationMinutes, ALLOWED_BOOKING_DURATIONS_MINUTES, FREE_CANCELLATION_WINDOW_HOURS } from "@smartbimbel/shared";
import { useAuth } from "../hooks/useAuth";
import {
  acceptBooking,
  acceptReschedule,
  Booking,
  BOOKING_STATUS_BADGE_VARIANT,
  BOOKING_STATUS_LABELS,
  BookingHistoryEntry,
  cancelBooking,
  CANCELLATION_REASON_LABELS,
  CancellationReasonCode,
  counterProposeBooking,
  declineBooking,
  declineReschedule,
  deleteBooking,
  editBooking,
  getBooking,
  getBookingHistory,
  proposeReschedule,
} from "../lib/bookings";
import { getMyTutorProfile } from "../lib/tutors";
import { useRouter } from "next/navigation";
import { JoinMeetingSection } from "./JoinMeetingSection";
import { SessionCompletionSection } from "./SessionCompletionSection";
import { SessionNotesSection } from "./SessionNotesSection";
import { ReviewSection } from "./ReviewSection";

const CANCELLABLE_STATUSES: Booking["status"][] = [
  "REQUESTED",
  "COUNTER_PROPOSED",
  "ACCEPTED",
  "RESCHEDULE_PROPOSED",
  "CONFIRMED",
];

const TUTOR_CANCELLABLE_STATUSES: Booking["status"][] = [
  ...CANCELLABLE_STATUSES,
  "COMPLETED",
];

const CANCELLATION_REASON_CODES = Object.keys(
  CANCELLATION_REASON_LABELS,
) as CancellationReasonCode[];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
}

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeInputValue(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type Panel = "decline" | "counter" | "reschedule" | "cancel" | "edit" | "delete" | null;

export function BookingDetail({
  bookingId,
  onUpdated,
}: {
  bookingId: string;
  onUpdated?: (booking: Booking) => void;
}) {
  const router = useRouter();
  const { sessionUser } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [history, setHistory] = useState<BookingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  const [declineReason, setDeclineReason] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [cancelReasonCode, setCancelReasonCode] = useState<CancellationReasonCode>(
    "SCHEDULE_CONFLICT",
  );
  const [cancelDetails, setCancelDetails] = useState("");

  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState<AllowedBookingDurationMinutes | "">("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editMode, setEditMode] = useState<"ONLINE" | "OFFLINE" | "">("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubjects, setEditSubjects] = useState<{ id: string; name: string }[]>([]);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    Promise.all([getBooking(bookingId), getBookingHistory(bookingId)])
      .then(([b, h]) => {
        setBooking(b);
        setHistory(h);
      })
      .catch(() => setLoadError("Gagal memuat detail booking."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [bookingId]);

  async function runAction(action: () => Promise<Booking>) {
    setActionError(null);
    setSubmitting(true);
    try {
      const updated = await action();
      setBooking(updated);
      onUpdated?.(updated);
      setPanel(null);
      setHistory(await getBookingHistory(bookingId));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Aksi gagal.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditPanel() {
    if (!booking) return;
    setEditDate(toDateInputValue(booking.scheduledAt));
    setEditTime(toTimeInputValue(booking.scheduledAt));
    setEditDuration(booking.durationMinutes as AllowedBookingDurationMinutes);
    setEditSubjectId(booking.subject.id);
    setEditMode(booking.mode);
    setEditNotes(booking.notes ?? "");
    setPanel("edit");
    if (editSubjects.length === 0) {
      getMyTutorProfile().then((p) => setEditSubjects(p?.subjects ?? []));
    }
  }

  if (loading) return <LoadingSpinner />;
  if (loadError || !booking) {
    return <ErrorState description={loadError ?? "Booking tidak ditemukan."} onRetry={refresh} />;
  }

  const isTutor = sessionUser?.role === "TUTOR" && sessionUser.id === booking.tutor.userId;
  const isStudent = sessionUser?.role === "STUDENT" && sessionUser.id === booking.student.userId;
  const isParticipant = isTutor || isStudent;
  const counterpart = isTutor ? booking.student.user : booking.tutor.user;

  const canTutorRespond = isTutor && booking.status === "REQUESTED";
  const canStudentRespond = isStudent && booking.status === "COUNTER_PROPOSED";
  const canProposeReschedule = isParticipant && booking.status === "ACCEPTED";
  const isReschedulePending = booking.status === "RESCHEDULE_PROPOSED";
  const isReschedulingParty = isReschedulePending && booking.rescheduleProposedByUserId === sessionUser?.id;
  const canRespondToReschedule = isReschedulePending && isParticipant && !isReschedulingParty;
  const sessionEnded =
    new Date(booking.scheduledAt).getTime() + booking.durationMinutes * 60 * 1000 <= Date.now();
  // Students cannot cancel after the session ends; tutors can cancel past
  // and COMPLETED sessions so they appear in red on calendars.
  const canCancel = isTutor
    ? TUTOR_CANCELLABLE_STATUSES.includes(booking.status)
    : isParticipant && CANCELLABLE_STATUSES.includes(booking.status) && !sessionEnded;
  const canDelete = isTutor;
  // A tutor-initiated booking (requestedByUserId is the tutor's own
  // userId) is CONFIRMED with no wait at all - see BookingsService.create
  // - so the tutor can write the report as soon as it's scheduled, not
  // just after it ends.
  const isTutorInitiated = booking.requestedByUserId === booking.tutor.userId;
  const canEdit =
    isTutor &&
    isTutorInitiated &&
    booking.status === "CONFIRMED" &&
    new Date(booking.scheduledAt).getTime() > Date.now();
  // Visible to both participants once it's showable - only *writing* it is
  // tutor-only (SessionNotesSection's own isTutor-gated edit button).
  const showSessionNotes =
    booking.status === "COMPLETED" ||
    (isParticipant && booking.status === "CONFIRMED" && (sessionEnded || isTutorInitiated));

  const noPanelOpen = panel === null;

  // Preview of the same rule the backend applies at cancel time (Task 3.5)
  // - a REQUESTED/COUNTER_PROPOSED booking was never confirmed, so
  // withdrawing it is always free regardless of timing.
  const wasCommitted =
    booking.status === "ACCEPTED" ||
    booking.status === "RESCHEDULE_PROPOSED" ||
    booking.status === "CONFIRMED";
  const hoursUntilSession = (new Date(booking.scheduledAt).getTime() - Date.now()) / (60 * 60 * 1000);
  const cancelWouldBeLate =
    !sessionEnded && wasCommitted && hoursUntilSession < FREE_CANCELLATION_WINDOW_HOURS;

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold">{booking.subject.name}</h1>
            <Badge variant={BOOKING_STATUS_BADGE_VARIANT[booking.status]}>
              {BOOKING_STATUS_LABELS[booking.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Dengan {counterpart?.name ?? "Pengguna"}</p>
          <p className="mt-2 text-sm text-foreground">{formatDateTime(booking.scheduledAt)}</p>
          <p className="text-sm text-muted-foreground">
            {booking.durationMinutes} menit &middot; {booking.mode === "ONLINE" ? "Online" : "Tatap muka"}
          </p>
          {booking.notes && <p className="mt-2 text-sm text-muted-foreground">Catatan: {booking.notes}</p>}
          {booking.status === "COUNTER_PROPOSED" && booking.proposedScheduledAt && (
            <p className="mt-2 text-sm text-warning-700">
              Waktu usulan: {formatDateTime(booking.proposedScheduledAt)}
            </p>
          )}
          {booking.status === "RESCHEDULE_PROPOSED" && booking.proposedScheduledAt && (
            <p className="mt-2 text-sm text-warning-700">
              {isReschedulingParty
                ? `Menunggu ${counterpart?.name ?? "pihak lain"} merespons jadwal baru: `
                : "Jadwal baru diusulkan: "}
              {formatDateTime(booking.proposedScheduledAt)}
            </p>
          )}
          {booking.status === "DECLINED" && booking.declineReason && (
            <p className="mt-2 text-sm text-muted-foreground">Alasan: {booking.declineReason}</p>
          )}
          {booking.status === "CANCELLED" && (
            <div className="mt-2 text-sm text-muted-foreground">
              {booking.cancellationReasonCode && (
                <p>Alasan: {CANCELLATION_REASON_LABELS[booking.cancellationReasonCode]}</p>
              )}
              {booking.cancellationReason && <p>{booking.cancellationReason}</p>}
              {booking.isLateCancellation && (
                <p className="text-warning-700">Dibatalkan di luar jendela pembatalan gratis.</p>
              )}
            </div>
          )}
          {booking.noShowReported && (
            <p className="mt-2 text-sm text-destructive">Sesi ini dilaporkan tidak dihadiri.</p>
          )}
        </CardContent>
      </Card>

      {isParticipant &&
        (booking.status === "CONFIRMED" || booking.status === "COMPLETED") && (
          <JoinMeetingSection booking={booking} bookingId={bookingId} />
        )}

      {isTutor && booking.status === "CONFIRMED" && (
        <SessionCompletionSection booking={booking} onUpdated={setBooking} />
      )}

      {showSessionNotes && (
        <SessionNotesSection booking={booking} isTutor={isTutor} onUpdated={setBooking} />
      )}

      {isStudent && booking.status === "COMPLETED" && <ReviewSection bookingId={bookingId} />}

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {(canTutorRespond || canStudentRespond) && noPanelOpen && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={submitting} onClick={() => runAction(() => acceptBooking(bookingId))}>
            Terima
          </Button>
          <Button variant="secondary" disabled={submitting} onClick={() => setPanel("decline")}>
            Tolak
          </Button>
          {canTutorRespond && (
            <Button variant="ghost" disabled={submitting} onClick={() => setPanel("counter")}>
              Usulkan waktu lain
            </Button>
          )}
        </div>
      )}

      {canRespondToReschedule && noPanelOpen && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={submitting} onClick={() => runAction(() => acceptReschedule(bookingId))}>
            Terima Jadwal Baru
          </Button>
          <Button
            variant="secondary"
            disabled={submitting}
            onClick={() => runAction(() => declineReschedule(bookingId))}
          >
            Pertahankan Jadwal Semula
          </Button>
        </div>
      )}

      {(canProposeReschedule || canCancel || canEdit || canDelete) && noPanelOpen && (
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="ghost" disabled={submitting} onClick={openEditPanel}>
              Edit Sesi
            </Button>
          )}
          {canProposeReschedule && (
            <Button variant="ghost" disabled={submitting} onClick={() => setPanel("reschedule")}>
              Ajukan Jadwal Ulang
            </Button>
          )}
          {canCancel && (
            <Button variant="danger" disabled={submitting} onClick={() => setPanel("cancel")}>
              Batalkan
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" disabled={submitting} onClick={() => setPanel("delete")}>
              Hapus
            </Button>
          )}
        </div>
      )}

      {panel === "edit" && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            <label className="text-sm font-medium" htmlFor="edit-date">
              Tanggal
            </label>
            <input
              id="edit-date"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="min-h-11 rounded-md border border-input px-3"
            />
            <label className="text-sm font-medium" htmlFor="edit-time">
              Waktu
            </label>
            <input
              id="edit-time"
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="min-h-11 rounded-md border border-input px-3"
            />
            <label className="text-sm font-medium" htmlFor="edit-duration">
              Durasi (menit)
            </label>
            {booking.packageId ? (
              <p className="text-sm text-muted-foreground">
                {editDuration} menit &middot; Ditentukan oleh paket
              </p>
            ) : (
              <select
                id="edit-duration"
                value={editDuration}
                onChange={(e) => setEditDuration(Number(e.target.value) as AllowedBookingDurationMinutes)}
                className="min-h-11 rounded-md border border-input px-3"
              >
                {ALLOWED_BOOKING_DURATIONS_MINUTES.map((d) => (
                  <option key={d} value={d}>
                    {d} menit
                  </option>
                ))}
              </select>
            )}
            <label className="text-sm font-medium" htmlFor="edit-subject">
              Mata pelajaran
            </label>
            <select
              id="edit-subject"
              value={editSubjectId}
              onChange={(e) => setEditSubjectId(e.target.value)}
              className="min-h-11 rounded-md border border-input px-3"
            >
              {editSubjects.length === 0 && <option value={editSubjectId}>{booking.subject.name}</option>}
              {editSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label className="text-sm font-medium" htmlFor="edit-mode">
              Metode
            </label>
            <select
              id="edit-mode"
              value={editMode}
              onChange={(e) => setEditMode(e.target.value as "ONLINE" | "OFFLINE")}
              className="min-h-11 rounded-md border border-input px-3"
            >
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Tatap muka</option>
            </select>
            <label className="text-sm font-medium" htmlFor="edit-notes">
              Catatan (opsional)
            </label>
            <textarea
              id="edit-notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="rounded-md border border-input p-2 text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                disabled={submitting || !editDate || !editTime || !editSubjectId || !editMode}
                onClick={() =>
                  runAction(() =>
                    editBooking(bookingId, {
                      scheduledDate: editDate,
                      startTime: editTime,
                      durationMinutes: editDuration || undefined,
                      subjectId: editSubjectId,
                      mode: editMode || undefined,
                      notes: editNotes || undefined,
                    }),
                  )
                }
              >
                Simpan Perubahan
              </Button>
              <Button variant="ghost" disabled={submitting} onClick={() => setPanel(null)}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {panel === "decline" && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            <label className="text-sm font-medium" htmlFor="decline-reason">
              Alasan (opsional)
            </label>
            <textarea
              id="decline-reason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="rounded-md border border-input p-2 text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                disabled={submitting}
                onClick={() => runAction(() => declineBooking(bookingId, declineReason || undefined))}
              >
                Konfirmasi Tolak
              </Button>
              <Button variant="ghost" disabled={submitting} onClick={() => setPanel(null)}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {panel === "counter" && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            <label className="text-sm font-medium" htmlFor="counter-date">
              Tanggal baru
            </label>
            <input
              id="counter-date"
              type="date"
              value={proposedDate}
              onChange={(e) => setProposedDate(e.target.value)}
              className="min-h-11 rounded-md border border-input px-3"
            />
            <label className="text-sm font-medium" htmlFor="counter-time">
              Waktu baru
            </label>
            <input
              id="counter-time"
              type="time"
              value={proposedTime}
              onChange={(e) => setProposedTime(e.target.value)}
              className="min-h-11 rounded-md border border-input px-3"
            />
            <div className="flex gap-2">
              <Button
                disabled={submitting || !proposedDate || !proposedTime}
                onClick={() =>
                  runAction(() => counterProposeBooking(bookingId, proposedDate, proposedTime))
                }
              >
                Kirim Usulan
              </Button>
              <Button variant="ghost" disabled={submitting} onClick={() => setPanel(null)}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {panel === "reschedule" && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            <label className="text-sm font-medium" htmlFor="reschedule-date">
              Tanggal baru
            </label>
            <input
              id="reschedule-date"
              type="date"
              value={proposedDate}
              onChange={(e) => setProposedDate(e.target.value)}
              className="min-h-11 rounded-md border border-input px-3"
            />
            <label className="text-sm font-medium" htmlFor="reschedule-time">
              Waktu baru
            </label>
            <input
              id="reschedule-time"
              type="time"
              value={proposedTime}
              onChange={(e) => setProposedTime(e.target.value)}
              className="min-h-11 rounded-md border border-input px-3"
            />
            <div className="flex gap-2">
              <Button
                disabled={submitting || !proposedDate || !proposedTime}
                onClick={() =>
                  runAction(() => proposeReschedule(bookingId, proposedDate, proposedTime))
                }
              >
                Ajukan Jadwal Ulang
              </Button>
              <Button variant="ghost" disabled={submitting} onClick={() => setPanel(null)}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {panel === "cancel" && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            {sessionEnded ? (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Sesi ini sudah lewat. Membatalkan akan menampilkannya berwarna merah di kalender.
              </p>
            ) : cancelWouldBeLate ? (
              <p className="rounded-md bg-warning-50 p-3 text-sm text-warning-700">
                Sesi kurang dari {FREE_CANCELLATION_WINDOW_HOURS} jam lagi - pembatalan ini akan
                tercatat sebagai pembatalan terlambat.
              </p>
            ) : (
              <p className="rounded-md bg-success-50 p-3 text-sm text-success-700">
                Pembatalan ini gratis - sesi masih {Math.max(0, Math.round(hoursUntilSession))} jam
                lagi.
              </p>
            )}
            <label className="text-sm font-medium" htmlFor="cancel-reason-code">
              Alasan pembatalan
            </label>
            <select
              id="cancel-reason-code"
              value={cancelReasonCode}
              onChange={(e) => setCancelReasonCode(e.target.value as CancellationReasonCode)}
              className="min-h-11 rounded-md border border-input px-3"
            >
              {CANCELLATION_REASON_CODES.map((code) => (
                <option key={code} value={code}>
                  {CANCELLATION_REASON_LABELS[code]}
                </option>
              ))}
            </select>
            <label className="text-sm font-medium" htmlFor="cancel-details">
              Detail (opsional)
            </label>
            <textarea
              id="cancel-details"
              value={cancelDetails}
              onChange={(e) => setCancelDetails(e.target.value)}
              className="rounded-md border border-input p-2 text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                disabled={submitting}
                onClick={() =>
                  runAction(() => cancelBooking(bookingId, cancelReasonCode, cancelDetails || undefined))
                }
              >
                Konfirmasi Batalkan
              </Button>
              <Button variant="ghost" disabled={submitting} onClick={() => setPanel(null)}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {panel === "delete" && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            <p className="text-sm text-muted-foreground">
              Hapus sesi ini dari kalender? Sesi tidak akan tampil lagi. Riwayat dan data pembayaran
              tetap tersimpan.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                disabled={submitting}
                onClick={() => {
                  setSubmitting(true);
                  setActionError(null);
                  deleteBooking(bookingId)
                    .then(() => {
                      onUpdated?.(booking);
                      router.push("/");
                    })
                    .catch((e: unknown) => {
                      setActionError(e instanceof Error ? e.message : "Gagal menghapus sesi.");
                      setSubmitting(false);
                    });
                }}
              >
                Konfirmasi Hapus
              </Button>
              <Button variant="ghost" disabled={submitting} onClick={() => setPanel(null)}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Riwayat</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {history.map((h) => (
                <li key={h.id}>
                  {BOOKING_STATUS_LABELS[h.toStatus]} &middot; {formatDateTime(h.createdAt)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
