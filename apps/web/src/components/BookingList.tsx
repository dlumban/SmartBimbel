"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, EmptyState, ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../hooks/useAuth";
import {
  Booking,
  BOOKING_STATUS_BADGE_VARIANT,
  BOOKING_STATUS_LABELS,
  BookingBucket,
  listBookings,
} from "../lib/bookings";

const TABS: { key: BookingBucket; label: string }[] = [
  { key: "upcoming", label: "Akan Datang" },
  { key: "past", label: "Selesai" },
  { key: "cancelled", label: "Dibatalkan" },
];

const EMPTY_MESSAGES: Record<BookingBucket, string> = {
  upcoming: "Belum ada sesi yang akan datang.",
  past: "Belum ada riwayat booking.",
  cancelled: "Tidak ada booking yang dibatalkan.",
};

// Beranda's booking list is a quick-glance summary, not the full history -
// each tab shows at most this many (soonest/most-recent first, per the
// existing bucket ordering), with no further pagination. Anything beyond
// that lives in the full calendar view (see the "Lihat kalender lengkap"
// link below) rather than a "load more" here.
const LIMIT = 20;

export function BookingList() {
  const { sessionUser } = useAuth();
  const [tab, setTab] = useState<BookingBucket>("upcoming");
  const [data, setData] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    listBookings({ bucket: tab, page: 1, limit: LIMIT })
      .then((res) => {
        setData(res.data);
        setTotal(res.total);
      })
      .catch(() => setError("Gagal memuat booking."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [tab]);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "true" : undefined}
            className={`min-h-11 px-4 text-sm font-medium ${
              tab === t.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorState description={error} onRetry={refresh} />
      ) : data.length === 0 ? (
        <EmptyState title={EMPTY_MESSAGES[tab]} />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.map((booking) => {
              const counterpart =
                sessionUser?.role === "TUTOR" ? booking.student.user : booking.tutor.user;
              return (
                <li key={booking.id}>
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3 hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{counterpart?.name ?? "Pengguna"}</span>
                      <Badge variant={BOOKING_STATUS_BADGE_VARIANT[booking.status]}>
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">{booking.subject.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(booking.scheduledAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {total > LIMIT && (
            <Link
              href="/bookings/calendar"
              className="self-center text-sm font-medium text-primary hover:underline"
            >
              Lihat kalender lengkap &rarr;
            </Link>
          )}
        </>
      )}
    </div>
  );
}
