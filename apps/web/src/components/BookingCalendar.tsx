"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../hooks/useAuth";
import { Booking, listAllBookings } from "../lib/bookings";
import { BusyBlock, SchedulingCalendar } from "./SchedulingCalendar";

type CalendarView = "month" | "week";

const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_LABELS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatBookingTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBookingChipTitle(name: string, subject: string, iso: string): string {
  return `${formatBookingTime(iso)} · ${name} · ${subject}`;
}

interface CalendarBusyBlock extends BusyBlock {
  bookingId: string;
}

function toBusyBlock(booking: Booking, role: "STUDENT" | "TUTOR" | "ADMIN" | null): CalendarBusyBlock {
  const counterpart = role === "TUTOR" ? booking.student.user : booking.tutor.user;
  return {
    scheduledAt: booking.scheduledAt,
    durationMinutes: booking.durationMinutes,
    studentName: counterpart?.name ?? "Pengguna",
    subjectName: booking.subject.name,
    completed: booking.status === "COMPLETED",
    cancelled: booking.status === "CANCELLED",
    bookingId: booking.id,
  };
}

function viewToggleClass(active: boolean): string {
  return active
    ? "bg-primary text-primary-foreground"
    : "bg-muted text-muted-foreground hover:bg-muted/80";
}

/**
 * Month-grid view of every booking (past, present, and future), grouped by
 * day - the per-day chips are keyed off scheduledAt in local time. Used
 * both as a tutor's Beranda overview (cancelled sessions excluded there,
 * per that page's own request) and as students' standalone full-calendar
 * page (cancelled included, since that page's whole point is completeness).
 */
export function BookingCalendar({ includeCancelled = true }: { includeCancelled?: boolean }) {
  const router = useRouter();
  const { sessionUser } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  function refresh() {
    setLoading(true);
    setError(null);
    listAllBookings()
      .then(setBookings)
      .catch(() => setError("Gagal memuat booking."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  const visibleBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (includeCancelled || b.status !== "CANCELLED") &&
          b.status !== "DECLINED" &&
          b.status !== "EXPIRED",
      ),
    [bookings, includeCancelled],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of visibleBookings) {
      const key = dateKey(new Date(b.scheduledAt));
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    }
    return map;
  }, [visibleBookings]);

  const busyBlocks = useMemo(
    () => visibleBookings.map((b) => toBusyBlock(b, sessionUser?.role ?? null)),
    [visibleBookings, sessionUser?.role],
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState description={error} onRetry={refresh} />;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const today = dateKey(new Date());

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          <button
            type="button"
            onClick={() => setView("month")}
            className={`min-h-9 px-4 text-sm font-medium ${viewToggleClass(view === "month")}`}
          >
            Bulan
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            className={`min-h-9 px-4 text-sm font-medium ${viewToggleClass(view === "week")}`}
          >
            Minggu
          </button>
        </div>
      </div>

      {view === "week" ? (
        <SchedulingCalendar
          busy={busyBlocks}
          selected={null}
          onSelect={() => {}}
          allowPastSlots
          onBusyBlockClick={(block) => router.push(`/bookings/${(block as CalendarBusyBlock).bookingId}`)}
        />
      ) : (
        <>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="min-h-9 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          &larr; Sebelumnya
        </button>
        <h2 className="text-xl font-semibold">
          {MONTH_LABELS[month]} {year}
        </h2>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="min-h-9 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          Berikutnya &rarr;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="bg-muted px-2 py-2 text-center text-sm font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startWeekday + 1;
          const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const key = inMonth ? dateKey(new Date(year, month, dayNum)) : null;
          const items = key ? (byDate.get(key) ?? []) : [];

          return (
            <div
              key={i}
              className={`min-h-36 p-1.5 sm:min-h-40 sm:p-2 ${inMonth ? "bg-card" : "bg-muted"} ${
                key === today ? "ring-2 ring-inset ring-primary" : ""
              }`}
            >
              {inMonth && (
                <>
                  <span className="text-sm font-medium text-muted-foreground">{dayNum}</span>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {items.map((b) => {
                      const counterpart =
                        sessionUser?.role === "TUTOR" ? b.student.user : b.tutor.user;
                      const name = counterpart?.name ?? "Pengguna";
                      const cancelled = b.status === "CANCELLED";
                      return (
                        <Link
                          key={b.id}
                          href={`/bookings/${b.id}`}
                          title={formatBookingChipTitle(name, b.subject.name, b.scheduledAt)}
                          className={`block rounded-md border px-2 py-1.5 ${
                            cancelled
                              ? "border-destructive/30 bg-destructive/10 hover:bg-destructive/20"
                              : "border-primary/20 bg-primary/10 hover:bg-primary/20"
                          }`}
                        >
                          <span
                            className={`block text-xs font-semibold leading-tight ${
                              cancelled ? "text-destructive" : "text-primary"
                            }`}
                          >
                            {formatBookingTime(b.scheduledAt)}
                          </span>
                          <span className="mt-0.5 block truncate text-xs font-medium leading-tight text-foreground">
                            {name}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                            {b.subject.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
}
