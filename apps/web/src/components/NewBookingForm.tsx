"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { AllowedBookingDurationMinutes } from "@smartbimbel/shared";
import { getTutorDetail, getTutorSchedule, TutorDetail, TutorScheduleBlock } from "../lib/discovery";
import { createBooking } from "../lib/bookings";
import { trackEvent } from "../lib/analytics";
import { SchedulingCalendar, SlotSelection } from "./SchedulingCalendar";

export function NewBookingForm({ tutorId }: { tutorId: string | null }) {
  const router = useRouter();
  const [tutor, setTutor] = useState<TutorDetail | null>(null);
  const [busy, setBusy] = useState<TutorScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const [subjectId, setSubjectId] = useState<string>("");
  const [mode, setMode] = useState<"ONLINE" | "OFFLINE" | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!tutorId) {
      setLoading(false);
      return;
    }
    Promise.all([getTutorDetail(tutorId), getTutorSchedule(tutorId)])
      .then(([t, schedule]) => {
        setTutor(t);
        setBusy(schedule);
        if (t.subjectOptions.length === 1) setSubjectId(t.subjectOptions[0].id);
        if (t.teachingModes.length === 1) setMode(t.teachingModes[0]);
      })
      .catch(() => setLoadError("Gagal memuat data tutor."))
      .finally(() => setLoading(false));
  }, [tutorId]);

  if (!tutorId) {
    return (
      <ErrorState
        title="Tutor tidak ditemukan"
        description="Buka halaman profil tutor lalu tekan “Pesan Sekarang”."
      />
    );
  }

  if (loading) return <LoadingSpinner />;
  if (loadError || !tutor) {
    return <ErrorState description={loadError ?? "Tutor tidak ditemukan."} />;
  }

  const durationMinutes = selection ? ((selection.slotCount * 30) as AllowedBookingDurationMinutes) : null;
  const canSubmit = Boolean(selection && subjectId && mode && durationMinutes);

  async function handleSubmit() {
    if (!selection || !mode || !durationMinutes) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const booking = await createBooking({
        tutorId: tutor!.id,
        startTime: selection.startTime,
        subjectId,
        scheduledDate: selection.date,
        durationMinutes,
        mode,
        notes: notes || undefined,
      });
      void trackEvent("booking_requested", {
        tutorId: tutor!.id,
        subjectId,
        durationMinutes,
        mode,
      });
      router.push(`/bookings/${booking.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Gagal mengirim permintaan booking.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">Booking dengan {tutor.name ?? "Tutor"}</h1>
        <Link href={`/tutors/${tutor.id}`} className="text-sm text-primary hover:underline">
          Lihat profil tutor
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Pilih jadwal</h2>
        <p className="text-xs text-muted-foreground">
          Klik satu atau beberapa setengah jam yang berurutan - waktu yang sudah dipesan ditandai abu-abu.
        </p>
        <SchedulingCalendar busy={busy} selected={selection} onSelect={setSelection} />
      </section>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <section className="flex flex-col gap-2">
          <label className="text-sm font-semibold" htmlFor="booking-subject">
            Mata pelajaran
          </label>
          <select
            id="booking-subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="min-h-11 rounded-md border border-input px-3"
          >
            <option value="" disabled>
              Pilih mata pelajaran
            </option>
            {tutor.subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </section>

        <section className="flex flex-col gap-2">
          <label className="text-sm font-semibold" htmlFor="booking-mode">
            Metode
          </label>
          <select
            id="booking-mode"
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
          <label className="text-sm font-semibold" htmlFor="booking-notes">
            Catatan (opsional)
          </label>
          <textarea
            id="booking-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-md border border-input p-2 text-sm"
            placeholder="Contoh: fokus ke materi integral"
          />
        </section>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <Button disabled={!canSubmit || submitting} onClick={handleSubmit} className="w-full">
          {submitting ? "Mengirim..." : "Kirim Permintaan Booking"}
        </Button>
      </div>
    </div>
  );
}
