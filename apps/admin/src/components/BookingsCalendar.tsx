"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import {
  ADMIN_BOOKING_STATUS_LABELS,
  AdminBookingDetail,
  AdminBookingListItem,
  getAdminBookingDetail,
  listBookingsInRange,
} from "../lib/bookings";
import { useAuth } from "../hooks/useAuth";
import { AdminBookingDetailPanel } from "./AdminBookingDetailPanel";

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

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = new Date(year, month, 1, 0, 0, 0, 0);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Platform-wide month calendar of every tutor/student session. Clicking a
 * chip opens the admin detail panel (notes, laporan sesi, review, history).
 */
export function BookingsCalendar() {
  const { sessionUser } = useAuth();
  const isSuperAdmin = sessionUser?.adminRole === "SUPER_ADMIN";

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [bookings, setBookings] = useState<AdminBookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminBookingDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  function refreshMonth() {
    setLoading(true);
    setError(null);
    const { from, to } = monthRange(year, month);
    listBookingsInRange(from, to)
      .then(setBookings)
      .catch(() => setError("Gagal memuat kalender booking."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refreshMonth, [year, month]);

  function loadDetail(id: string) {
    setSelectedId(id);
    setDetailError(null);
    getAdminBookingDetail(id)
      .then(setDetail)
      .catch(() => {
        setDetail(null);
        setDetailError("Gagal memuat detail sesi.");
      });
  }

  const byDate = useMemo(() => {
    const map = new Map<string, AdminBookingListItem[]>();
    for (const b of bookings) {
      const key = dateKey(new Date(b.scheduledAt));
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    }
    return map;
  }, [bookings]);

  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const today = dateKey(new Date());

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-4">
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

        {loading && <LoadingSpinner />}
        {error && <ErrorState description={error} onRetry={refreshMonth} />}
        {!loading && !error && (
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
                  className={`min-h-28 p-1 ${inMonth ? "bg-card" : "bg-muted"} ${
                    key === today ? "ring-2 ring-inset ring-primary" : ""
                  }`}
                >
                  {inMonth && (
                    <>
                      <span className="text-xs text-muted-foreground">{dayNum}</span>
                      <div className="mt-1 flex flex-col gap-0.5">
                        {items.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            title={`${b.subject.name} · ${b.student.user.name ?? "Siswa"} / ${b.tutor.user.name ?? "Tutor"} · ${ADMIN_BOOKING_STATUS_LABELS[b.status] ?? b.status}`}
                            onClick={() => loadDetail(b.id)}
                            className={`block truncate rounded px-1 py-0.5 text-left text-xs ${
                              selectedId === b.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                            }`}
                          >
                            {new Date(b.scheduledAt).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            {b.subject.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!loading && !error && (
          <p className="text-xs text-muted-foreground">
            {bookings.length} sesi di bulan ini (semua tutor &amp; siswa). Klik chip untuk detail.
          </p>
        )}
      </div>

      <div>
        {detailError && <p className="text-sm text-destructive">{detailError}</p>}
        {!detail && !detailError && (
          <p className="text-sm text-muted-foreground">Pilih sesi di kalender untuk melihat detail.</p>
        )}
        {detail && (
          <AdminBookingDetailPanel
            detail={detail}
            isSuperAdmin={!!isSuperAdmin}
            onUpdated={() => {
              loadDetail(detail.id);
              refreshMonth();
            }}
          />
        )}
      </div>
    </div>
  );
}
