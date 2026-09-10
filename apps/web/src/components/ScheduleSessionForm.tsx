"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { ACTIVE_BOOKING_STATUSES, AllowedBookingDurationMinutes } from "@smartbimbel/shared";
import { getMyTutorProfile, TutorProfile } from "../lib/tutors";
import { StudentListItem } from "../lib/students";
import { Booking, listAllBookings, scheduleSession } from "../lib/bookings";
import { listActivePackages, TutoringPackage } from "../lib/packages";
import { trackEvent } from "../lib/analytics";
import { StudentPickerTable } from "./StudentPickerTable";
import { BusyBlock, SchedulingCalendar, SlotSelection } from "./SchedulingCalendar";
import { BookingDetail } from "./BookingDetail";

const SCHEDULE_CALENDAR_STATUSES = new Set<Booking["status"]>([
  ...ACTIVE_BOOKING_STATUSES,
  "COMPLETED",
  "CANCELLED",
]);

interface ScheduleBusyBlock extends BusyBlock {
  bookingId: string;
  completed?: boolean;
}

function toBusyBlock(b: Booking): ScheduleBusyBlock {
  return {
    scheduledAt: b.scheduledAt,
    durationMinutes: b.durationMinutes,
    bookingId: b.id,
    studentName: b.student.user.name ?? "Siswa",
    subjectName: b.subject.name,
    completed: b.status === "COMPLETED",
    cancelled: b.status === "CANCELLED",
  };
}

export function ScheduleSessionForm() {
  const router = useRouter();
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentListItem | null>(null);
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string>("");
  const [mode, setMode] = useState<"ONLINE" | "OFFLINE" | "">("");
  const [notes, setNotes] = useState("");
  const [packages, setPackages] = useState<TutoringPackage[]>([]);
  const [packageId, setPackageId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const refreshBookings = useCallback(() => listAllBookings().then(setBookings), []);

  useEffect(() => {
    Promise.all([getMyTutorProfile(), refreshBookings(), listActivePackages()])
      .then(([profile, , activePackages]) => {
        setTutor(profile);
        if (profile?.subjects.length === 1) setSubjectId(profile.subjects[0].id);
        if (profile?.teachingModes.length === 1) setMode(profile.teachingModes[0]);
        setPackages(activePackages);
      })
      .catch(() => setLoadError("Gagal memuat profil dan jadwal Anda."))
      .finally(() => setLoading(false));
  }, [refreshBookings]);

  const busy = useMemo(
    () => bookings.filter((b) => SCHEDULE_CALENDAR_STATUSES.has(b.status)).map(toBusyBlock),
    [bookings],
  );

  if (loading) return <LoadingSpinner />;
  if (loadError || !tutor) {
    return <ErrorState description={loadError ?? "Lengkapi profil tutor Anda terlebih dahulu."} />;
  }

  const selectedPackage = packages.find((p) => p.id === packageId) ?? null;
  const durationMinutes = selectedPackage
    ? selectedPackage.durationMinutes
    : selection
      ? ((selection.slotCount * 30) as AllowedBookingDurationMinutes)
      : null;
  const canSubmit = Boolean(student && selection && subjectId && mode && durationMinutes);

  function handleSelect(next: SlotSelection | null) {
    setEditingBookingId(null);
    setSelection(next);
  }

  function handleBusyBlockClick(block: ScheduleBusyBlock) {
    setSelection(null);
    setEditingBookingId(block.bookingId);
  }

  async function handleSubmit() {
    if (!student || !selection || !mode || !durationMinutes) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const booking = await scheduleSession({
        studentId: student.studentProfileId,
        startTime: selection.startTime,
        subjectId,
        scheduledDate: selection.date,
        durationMinutes,
        mode,
        notes: notes || undefined,
        packageId: packageId || undefined,
      });
      void trackEvent("booking_requested", {
        tutorId: tutor!.id,
        subjectId,
        durationMinutes,
        mode,
      });
      router.push(`/bookings/${booking.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Gagal menjadwalkan sesi.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-bold">Jadwalkan Sesi</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Kalender</h2>
        <p className="text-xs text-muted-foreground">
          Klik setengah jam yang kosong untuk membuat sesi baru, atau klik sesi yang sudah ada untuk
          melihat/mengubahnya.{" "}
          <Link href="/bookings/schedule/bulk" className="text-primary hover:underline">
            Jadwalkan massal
          </Link>
        </p>
        <SchedulingCalendar
          busy={busy}
          selected={selection}
          onSelect={handleSelect}
          onBusyBlockClick={handleBusyBlockClick}
          allowPastSlots
        />
      </section>

      {editingBookingId && (
        <section className="mx-auto flex w-full max-w-lg flex-col gap-2">
          <h2 className="text-sm font-semibold">Detail Sesi</h2>
          <BookingDetail bookingId={editingBookingId} onUpdated={() => void refreshBookings()} />
        </section>
      )}

      {selection &&
        (!student ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Pilih siswa</h2>
            <StudentPickerTable onSelect={setStudent} />
          </section>
        ) : (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
            <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
              <span>
                Siswa: <span className="font-medium">{student.name ?? "Tanpa nama"}</span>{" "}
                {(student.phone ?? student.email) && `(${student.phone ?? student.email})`}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setStudent(null)}>
                Ganti
              </Button>
            </div>

            <section className="flex flex-col gap-2">
              <label className="text-sm font-semibold" htmlFor="schedule-subject">
                Mata pelajaran
              </label>
              <select
                id="schedule-subject"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="min-h-11 rounded-md border border-input px-3"
              >
                <option value="" disabled>
                  Pilih mata pelajaran
                </option>
                {tutor.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </section>

            {packages.length > 0 && (
              <section className="flex flex-col gap-2">
                <label className="text-sm font-semibold" htmlFor="schedule-package">
                  Paket (opsional)
                </label>
                <select
                  id="schedule-package"
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                  className="min-h-11 rounded-md border border-input px-3"
                >
                  <option value="">Tanpa paket (tarif per jam)</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.sessionCount} sesi x {p.durationMinutes} menit
                    </option>
                  ))}
                </select>
                {selectedPackage && (
                  <p className="text-xs text-muted-foreground">
                    Durasi sesi ditetapkan {selectedPackage.durationMinutes} menit oleh paket ini.
                    Pastikan slot yang dipilih di kalender berdurasi sama.
                  </p>
                )}
              </section>
            )}

            <section className="flex flex-col gap-2">
              <label className="text-sm font-semibold" htmlFor="schedule-mode">
                Metode
              </label>
              <select
                id="schedule-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as "ONLINE" | "OFFLINE")}
                className="min-h-11 rounded-md border border-input px-3"
              >
                <option value="" disabled>
                  Pilih metode
                </option>
                {tutor.teachingModes.map((m) => (
                  <option key={m} value={m}>
                    {m === "ONLINE" ? "Online" : "Tatap muka"}
                  </option>
                ))}
              </select>
            </section>

            <section className="flex flex-col gap-2">
              <label className="text-sm font-semibold" htmlFor="schedule-notes">
                Catatan (opsional)
              </label>
              <textarea
                id="schedule-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="rounded-md border border-input p-2 text-sm"
                placeholder="Contoh: fokus ke materi integral"
              />
            </section>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}

            <p className="text-xs text-muted-foreground">
              Sesi ini akan langsung terkonfirmasi begitu dikirim - siswa tidak perlu menyetujui
              terlebih dahulu.
            </p>

            <Button disabled={!canSubmit || submitting} onClick={handleSubmit} className="w-full">
              {submitting ? "Mengirim..." : "Jadwalkan Sesi"}
            </Button>
          </div>
        ))}
    </div>
  );
}
