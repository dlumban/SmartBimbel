"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { ACTIVE_BOOKING_STATUSES, ALLOWED_BOOKING_DURATIONS_MINUTES, AllowedBookingDurationMinutes } from "@smartbimbel/shared";
import { getMyTutorProfile, TutorProfile } from "../lib/tutors";
import { StudentListItem } from "../lib/students";
import { Booking, listAllBookings, scheduleSessionsBulk } from "../lib/bookings";
import { listActivePackages, TutoringPackage } from "../lib/packages";
import { trackEvent } from "../lib/analytics";
import { StudentPickerTable } from "./StudentPickerTable";
import {
  BusyBlock,
  formatSlotSelectionLabel,
  SchedulingCalendar,
  SlotSelection,
} from "./SchedulingCalendar";

const SCHEDULE_CALENDAR_STATUSES = new Set<Booking["status"]>([
  ...ACTIVE_BOOKING_STATUSES,
  "COMPLETED",
  "CANCELLED",
]);

interface SelectedSlot {
  date: string;
  startTime: string;
}

function toBusyBlock(b: Booking): BusyBlock {
  return {
    scheduledAt: b.scheduledAt,
    durationMinutes: b.durationMinutes,
    studentName: b.student.user.name ?? "Siswa",
    subjectName: b.subject.name,
    completed: b.status === "COMPLETED",
    cancelled: b.status === "CANCELLED",
  };
}

function slotKey(slot: SelectedSlot): string {
  return `${slot.date}|${slot.startTime}`;
}

export function BulkScheduleForm() {
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [student, setStudent] = useState<StudentListItem | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [mode, setMode] = useState<"ONLINE" | "OFFLINE" | "">("");
  const [durationMinutes, setDurationMinutes] = useState<AllowedBookingDurationMinutes | "">(60);
  const [notes, setNotes] = useState("");
  const [packages, setPackages] = useState<TutoringPackage[]>([]);
  const [packageId, setPackageId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

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

  const selectedPackage = packages.find((p) => p.id === packageId) ?? null;
  const effectiveDuration = selectedPackage
    ? selectedPackage.durationMinutes
    : durationMinutes || null;
  const slotCount = effectiveDuration ? effectiveDuration / 30 : 0;

  const calendarSlots: SlotSelection[] = useMemo(
    () =>
      selectedSlots.map((slot) => ({
        ...slot,
        slotCount,
      })),
    [selectedSlots, slotCount],
  );

  const canSubmit = Boolean(
    student && selectedSlots.length > 0 && subjectId && mode && effectiveDuration,
  );

  function toggleSlot(slot: SlotSelection) {
    const key = slotKey(slot);
    setSelectedSlots((prev) => {
      const exists = prev.some((s) => slotKey(s) === key);
      if (exists) return prev.filter((s) => slotKey(s) !== key);
      return [...prev, { date: slot.date, startTime: slot.startTime }];
    });
    setResultSummary(null);
  }

  function removeSlot(slot: SelectedSlot) {
    setSelectedSlots((prev) => prev.filter((s) => slotKey(s) !== slotKey(slot)));
  }

  async function handleSubmit() {
    if (!student || !effectiveDuration || !mode || selectedSlots.length === 0) return;
    setSubmitError(null);
    setResultSummary(null);
    setSubmitting(true);
    try {
      const { succeeded, failed } = await scheduleSessionsBulk(
        {
          studentId: student.studentProfileId,
          subjectId,
          durationMinutes: effectiveDuration,
          mode,
          notes: notes || undefined,
          packageId: packageId || undefined,
        },
        selectedSlots.map((slot) => ({
          scheduledDate: slot.date,
          startTime: slot.startTime,
        })),
      );

      void trackEvent("booking_requested", {
        tutorId: tutor!.id,
        subjectId,
        durationMinutes: effectiveDuration,
        mode,
        bulkCount: selectedSlots.length,
      });

      await refreshBookings();

      if (failed.length === 0) {
        setSelectedSlots([]);
        setResultSummary(`${succeeded.length} sesi berhasil dijadwalkan.`);
      } else if (succeeded.length === 0) {
        setSubmitError(`Semua sesi gagal dijadwalkan. ${failed[0]?.error ?? ""}`.trim());
      } else {
        setSelectedSlots(
          failed.map((f) => ({ date: f.slot.scheduledDate, startTime: f.slot.startTime })),
        );
        setResultSummary(
          `${succeeded.length} sesi berhasil, ${failed.length} gagal. Periksa slot yang tersisa.`,
        );
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Gagal menjadwalkan sesi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (loadError || !tutor) {
    return <ErrorState description={loadError ?? "Lengkapi profil tutor Anda terlebih dahulu."} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Jadwalkan Sesi Massal</h1>
        <p className="text-sm text-muted-foreground">
          Pilih satu siswa, lalu tandai beberapa hari dan jam sekaligus.{" "}
          <Link href="/bookings/schedule" className="text-primary hover:underline">
            Jadwalkan satu sesi
          </Link>
        </p>
      </div>

      {!student ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Pilih siswa</h2>
          <StudentPickerTable onSelect={setStudent} />
        </section>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            <span>
              Siswa: <span className="font-medium">{student.name ?? "Tanpa nama"}</span>{" "}
              {(student.phone ?? student.email) && `(${student.phone ?? student.email})`}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setStudent(null)}>
              Ganti
            </Button>
          </div>

          <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
            <section className="flex flex-col gap-2">
              <label className="text-sm font-semibold" htmlFor="bulk-subject">
                Mata pelajaran
              </label>
              <select
                id="bulk-subject"
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
                <label className="text-sm font-semibold" htmlFor="bulk-package">
                  Paket (opsional)
                </label>
                <select
                  id="bulk-package"
                  value={packageId}
                  onChange={(e) => {
                    setPackageId(e.target.value);
                    setSelectedSlots([]);
                  }}
                  className="min-h-11 rounded-md border border-input px-3"
                >
                  <option value="">Tanpa paket (tarif per jam)</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.sessionCount} sesi x {p.durationMinutes} menit
                    </option>
                  ))}
                </select>
              </section>
            )}

            {!selectedPackage && (
              <section className="flex flex-col gap-2">
                <label className="text-sm font-semibold" htmlFor="bulk-duration">
                  Durasi per sesi
                </label>
                <select
                  id="bulk-duration"
                  value={durationMinutes}
                  onChange={(e) => {
                    setDurationMinutes(Number(e.target.value) as AllowedBookingDurationMinutes);
                    setSelectedSlots([]);
                  }}
                  className="min-h-11 rounded-md border border-input px-3"
                >
                  {ALLOWED_BOOKING_DURATIONS_MINUTES.map((d) => (
                    <option key={d} value={d}>
                      {d} menit
                    </option>
                  ))}
                </select>
              </section>
            )}

            <section className="flex flex-col gap-2">
              <label className="text-sm font-semibold" htmlFor="bulk-mode">
                Metode
              </label>
              <select
                id="bulk-mode"
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
              <label className="text-sm font-semibold" htmlFor="bulk-notes">
                Catatan (opsional)
              </label>
              <textarea
                id="bulk-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="rounded-md border border-input p-2 text-sm"
                placeholder="Berlaku untuk semua sesi yang dipilih"
              />
            </section>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Pilih hari &amp; jam</h2>
            <p className="text-xs text-muted-foreground">
              Klik slot kosong untuk menambah atau menghapus jadwal. Navigasi minggu untuk memilih
              hari lain.
            </p>
            {effectiveDuration ? (
              <SchedulingCalendar
                busy={busy}
                selected={null}
                onSelect={() => {}}
                allowPastSlots
                multiSelect={{
                  slots: calendarSlots,
                  slotCount,
                  onToggle: toggleSlot,
                  onClear: () => setSelectedSlots([]),
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Pilih durasi sesi terlebih dahulu.</p>
            )}
          </section>

          {selectedSlots.length > 0 && effectiveDuration && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Ringkasan ({selectedSlots.length} sesi)</h2>
              <ul className="flex flex-col gap-2 rounded-lg border border-border p-3">
                {[...calendarSlots]
                  .sort(
                    (a, b) =>
                      a.date.localeCompare(b.date) ||
                      a.startTime.localeCompare(b.startTime),
                  )
                  .map((slot) => (
                    <li
                      key={slotKey(slot)}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>{formatSlotSelectionLabel(slot)}</span>
                      <button
                        type="button"
                        onClick={() => removeSlot(slot)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Hapus
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          {resultSummary && <p className="text-sm text-success-600">{resultSummary}</p>}

          <p className="text-xs text-muted-foreground">
            Semua sesi langsung terkonfirmasi begitu dikirim - siswa tidak perlu menyetujui
            terlebih dahulu.
          </p>

          <Button disabled={!canSubmit || submitting} onClick={handleSubmit} className="w-full">
            {submitting
              ? "Menjadwalkan..."
              : selectedSlots.length > 0
                ? `Jadwalkan ${selectedSlots.length} Sesi`
                : "Jadwalkan Sesi"}
          </Button>
        </>
      )}
    </div>
  );
}
