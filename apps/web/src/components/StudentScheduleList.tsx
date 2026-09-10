"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, EmptyState, ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import {
  Booking,
  BOOKING_STATUS_BADGE_VARIANT,
  BOOKING_STATUS_LABELS,
  listAllBookings,
} from "../lib/bookings";
import { listStudents } from "../lib/students";
import {
  downloadBlob,
  generateCombinedReportPdf,
} from "../lib/combinedReportPdf";

const DISPLAY_LIMIT = 20;

function startOfLocalDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function compareBookingsAsc(a: Booking, b: Booking): number {
  return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
}

/** Up to 20 sessions from today onward; if none, the 20 most recent before today. Ascending. */
export function selectDisplayedStudentSessions(
  bookings: Booking[],
  now: Date = new Date(),
  limit = DISPLAY_LIMIT,
): Booking[] {
  const sorted = [...bookings].sort(compareBookingsAsc);
  const todayStart = startOfLocalDay(now).getTime();

  const fromToday = sorted.filter((b) => new Date(b.scheduledAt).getTime() >= todayStart);
  if (fromToday.length > 0) {
    return fromToday.slice(0, limit);
  }

  const beforeToday = sorted.filter((b) => new Date(b.scheduledAt).getTime() < todayStart);
  return beforeToday.slice(-limit);
}

function formatSessionDay(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "long" });
}

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatSessionTimeRange(iso: string, durationMinutes: number): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)}–${fmt(end)}`;
}

function hasReport(booking: Booking): boolean {
  return Boolean(booking.sessionNotes?.trim());
}

export function StudentScheduleList({ studentUserId }: { studentUserId: string }) {
  const [studentName, setStudentName] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    Promise.all([
      listStudents({ mine: true, limit: 50 }).catch(() => null),
      listAllBookings(),
    ])
      .then(([studentsRes, allBookings]) => {
        const student = studentsRes?.data.find((s) => s.userId === studentUserId);
        setStudentName(
          student?.name ??
            allBookings.find((b) => b.student.userId === studentUserId)?.student.user.name ??
            null,
        );
        setBookings(allBookings.filter((b) => b.student.userId === studentUserId));
      })
      .catch(() => setError("Gagal memuat jadwal siswa."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [studentUserId]);

  const displayedBookings = useMemo(() => selectDisplayedStudentSessions(bookings), [bookings]);

  const reportableBookings = useMemo(
    () => bookings.filter(hasReport).sort(compareBookingsAsc),
    [bookings],
  );

  const heading = useMemo(() => studentName ?? "Siswa", [studentName]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setGenerateError(null);
  }

  function selectAllWithReports() {
    setSelectedIds(new Set(reportableBookings.map((b) => b.id)));
    setGenerateError(null);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setGenerateError(null);
  }

  async function handleGenerate() {
    const selected = reportableBookings.filter((b) => selectedIds.has(b.id));
    if (selected.length === 0) {
      setGenerateError("Pilih minimal satu sesi yang memiliki laporan.");
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const blob = await generateCombinedReportPdf({
        studentName: heading,
        bookings: selected,
      });
      const safeName = heading.replace(/[^\w\-]+/g, "_").slice(0, 40) || "siswa";
      downloadBlob(blob, `laporan-gabungan-${safeName}.pdf`);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Gagal membuat PDF.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/students" className="text-sm text-primary hover:underline">
            &larr; Murid Saya
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-foreground">Jadwal {heading}</h1>
        </div>
        <Link href="/bookings/schedule">
          <Button variant="secondary" size="sm">
            Jadwalkan Sesi
          </Button>
        </Link>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorState description={error} onRetry={refresh} />
      ) : displayedBookings.length === 0 && reportableBookings.length === 0 ? (
        <EmptyState title="Belum ada sesi untuk siswa ini." />
      ) : (
        <>
          {displayedBookings.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Hari</th>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Waktu</th>
                    <th className="px-3 py-2">Mata pelajaran</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedBookings.map((booking) => (
                    <tr key={booking.id} className="border-t border-border">
                      <td className="px-3 py-3 capitalize text-foreground">
                        {formatSessionDay(booking.scheduledAt)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatSessionDate(booking.scheduledAt)}
                      </td>
                      <td className="px-3 py-3 font-medium text-foreground">
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {formatSessionTimeRange(booking.scheduledAt, booking.durationMinutes)}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{booking.subject.name}</td>
                      <td className="px-3 py-3">
                        <Badge variant={BOOKING_STATUS_BADGE_VARIANT[booking.status]}>
                          {BOOKING_STATUS_LABELS[booking.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Laporan Gabungan</h2>
                <p className="text-xs text-muted-foreground">
                  Pilih sesi yang punya laporan, lalu unduh PDF kronologis (termasuk gambar).
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={reportableBookings.length === 0}
                  onClick={selectAllWithReports}
                >
                  Pilih semua
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={selectedIds.size === 0}
                  onClick={clearSelection}
                >
                  Hapus pilihan
                </Button>
                <Button
                  size="sm"
                  disabled={selectedIds.size === 0 || generating}
                  onClick={() => void handleGenerate()}
                >
                  {generating ? "Membuat PDF…" : `Buat PDF (${selectedIds.size})`}
                </Button>
              </div>
            </div>

            {generateError && <p className="text-sm text-destructive">{generateError}</p>}

            {reportableBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada sesi dengan laporan untuk digabungkan.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 w-10" />
                      <th className="px-3 py-2">Tanggal</th>
                      <th className="px-3 py-2">Waktu</th>
                      <th className="px-3 py-2">Mata pelajaran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportableBookings.map((booking) => (
                      <tr key={booking.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(booking.id)}
                            onChange={() => toggleSelected(booking.id)}
                            aria-label={`Pilih sesi ${formatSessionDate(booking.scheduledAt)}`}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="px-3 py-2 capitalize text-foreground">
                          {formatSessionDay(booking.scheduledAt)},{" "}
                          {formatSessionDate(booking.scheduledAt)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatSessionTimeRange(booking.scheduledAt, booking.durationMinutes)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{booking.subject.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
