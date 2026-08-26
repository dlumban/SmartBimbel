"use client";

import { useEffect, useState } from "react";
import { Badge, Button, ErrorState, Input, LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../hooks/useAuth";
import {
  ADMIN_BOOKING_STATUS_LABELS,
  AdminBookingDetail,
  AdminBookingListItem,
  getAdminBookingDetail,
  searchBookings,
} from "../lib/bookings";
import { AdminBookingDetailPanel } from "./AdminBookingDetailPanel";

/**
 * Platform-wide booking search (Task 7.3). Detail panel is shared with the
 * calendar view so support staff always see notes, laporan, and history.
 */
export function BookingsManagement() {
  const { sessionUser } = useAuth();
  const isSuperAdmin = sessionUser?.adminRole === "SUPER_ADMIN";

  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [bookings, setBookings] = useState<AdminBookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminBookingDetail | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    searchBookings({ status: status || undefined, q: q || undefined, limit: 50 })
      .then((res) => setBookings(res.data))
      .catch(() => setLoadError("Gagal memuat daftar booking."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  function loadDetail(id: string) {
    setSelectedId(id);
    setActionError(null);
    getAdminBookingDetail(id)
      .then(setDetail)
      .catch(() => setActionError("Gagal memuat detail."));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
      <div className="flex flex-col gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            refresh();
          }}
          className="flex flex-col gap-2"
        >
          <Input label="Cari (nama)" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="text-sm font-medium" htmlFor="status-filter">
            Status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="min-h-11 rounded-md border border-input px-3"
          >
            <option value="">Semua</option>
            {[
              "REQUESTED",
              "ACCEPTED",
              "CONFIRMED",
              "COMPLETED",
              "CANCELLED",
              "DECLINED",
              "EXPIRED",
            ].map((s) => (
              <option key={s} value={s}>
                {ADMIN_BOOKING_STATUS_LABELS[s] ?? s}
              </option>
            ))}
          </select>
          <Button type="submit">Cari</Button>
        </form>

        {loading && <LoadingSpinner />}
        {loadError && <ErrorState description={loadError} onRetry={refresh} />}
        {!loading && !loadError && (
          <ul className="flex flex-col gap-2">
            {bookings.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => loadDetail(b.id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm ${
                    selectedId === b.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{b.subject.name}</span>
                    <Badge variant="neutral">
                      {ADMIN_BOOKING_STATUS_LABELS[b.status] ?? b.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {b.student.user.name ?? "Siswa"} &middot; {b.tutor.user.name ?? "Tutor"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(b.scheduledAt).toLocaleString("id-ID")}
                  </p>
                </button>
              </li>
            ))}
            {bookings.length === 0 && (
              <p className="text-sm text-muted-foreground">Tidak ada hasil.</p>
            )}
          </ul>
        )}
      </div>

      <div>
        {actionError && <p className="mb-2 text-sm text-destructive">{actionError}</p>}
        {!detail ? (
          <p className="text-sm text-muted-foreground">Pilih booking untuk melihat detail.</p>
        ) : (
          <AdminBookingDetailPanel
            detail={detail}
            isSuperAdmin={!!isSuperAdmin}
            onUpdated={() => {
              loadDetail(detail.id);
              refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
