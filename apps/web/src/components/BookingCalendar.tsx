"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../hooks/useAuth";
import { Booking, listAllBookings } from "../lib/bookings";

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

/**
 * Month-grid view of every booking (past, present, and future), grouped by
 * day - the per-day chips are keyed off scheduledAt in local time. Used
 * both as a tutor's Beranda overview (cancelled sessions excluded there,
 * per that page's own request) and as students' standalone full-calendar
 * page (cancelled included, since that page's whole point is completeness).
 */
export function BookingCalendar({ includeCancelled = true }: { includeCancelled?: boolean }) {
  const { sessionUser } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const byDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (!includeCancelled && b.status === "CANCELLED") continue;
      const key = dateKey(new Date(b.scheduledAt));
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    }
    return map;
  }, [bookings, includeCancelled]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState description={error} onRetry={refresh} />;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const today = dateKey(new Date());

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="min-h-9 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          &larr; Sebelumnya
        </button>
        <h2 className="text-lg font-semibold">
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

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="bg-muted px-2 py-1 text-center text-xs font-medium text-muted-foreground"
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
              className={`min-h-24 p-1 ${inMonth ? "bg-card" : "bg-muted"} ${
                key === today ? "ring-2 ring-inset ring-primary" : ""
              }`}
            >
              {inMonth && (
                <>
                  <span className="text-xs text-muted-foreground">{dayNum}</span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {items.map((b) => {
                      const counterpart =
                        sessionUser?.role === "TUTOR" ? b.student.user : b.tutor.user;
                      return (
                        <Link
                          key={b.id}
                          href={`/bookings/${b.id}`}
                          title={`${counterpart?.name ?? "Pengguna"} – ${b.subject.name}`}
                          className="block truncate rounded bg-primary/10 px-1 py-0.5 text-xs text-primary hover:bg-primary/20"
                        >
                          {new Date(b.scheduledAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          {counterpart?.name ?? "Pengguna"}
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
    </div>
  );
}
