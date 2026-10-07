"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingSpinner } from "@smartbimbel/ui";
import { useAuth } from "../hooks/useAuth";
import { Booking, listAllBookings } from "../lib/bookings";
import { BusyBlock, SchedulingCalendar, SlotSelection } from "./SchedulingCalendar";

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

function formatBookingChipTitle(
  name: string,
  subject: string,
  iso: string,
  notes?: string | null,
): string {
  const base = `${formatBookingTime(iso)} · ${name} · ${subject}`;
  const trimmed = notes?.trim();
  return trimmed ? `${base} · Catatan: ${trimmed}` : base;
}

/** Chip surface for month-grid sessions: cancelled / completed / upcoming. */
export function bookingChipSurfaceClass(status: Booking["status"]): string {
  if (status === "CANCELLED") {
    return "border-destructive/30 bg-destructive/10 hover:bg-destructive/20";
  }
  if (status === "COMPLETED") {
    return "border-success-600/30 bg-success-50 hover:bg-success-50/80";
  }
  return "border-primary/20 bg-primary/10 hover:bg-primary/20";
}

export function bookingChipTimeClass(status: Booking["status"]): string {
  if (status === "CANCELLED") return "text-destructive";
  if (status === "COMPLETED") return "text-success-700";
  return "text-primary";
}

export interface CalendarBusyBlock extends BusyBlock {
  bookingId: string;
  groupId?: string | null;
}

function toBusyBlock(booking: Booking, role: "STUDENT" | "TUTOR" | "ADMIN" | null): CalendarBusyBlock {
  const counterpart = role === "TUTOR" ? booking.student.user : booking.tutor.user;
  const groupLabel =
    role === "TUTOR" && booking.group && booking.group.memberCount > 1
      ? `Grup (${booking.group.memberCount}): ${booking.group.members.map((m) => m.studentName).join(", ")}`
      : null;
  return {
    scheduledAt: booking.scheduledAt,
    durationMinutes: booking.durationMinutes,
    studentName: groupLabel ?? counterpart?.name ?? "Pengguna",
    subjectName: booking.subject.name,
    notes: booking.notes,
    completed: booking.status === "COMPLETED",
    cancelled: booking.status === "CANCELLED",
    bookingId: booking.id,
    groupId: booking.group?.id ?? booking.groupId ?? null,
  };
}

/** One calendar block per group (or solo booking). */
function coalesceBusyBlocks(
  bookings: Booking[],
  role: "STUDENT" | "TUTOR" | "ADMIN" | null,
): CalendarBusyBlock[] {
  const seenGroups = new Set<string>();
  const blocks: CalendarBusyBlock[] = [];
  for (const b of bookings) {
    const gid = b.group?.id ?? b.groupId;
    if (gid) {
      if (seenGroups.has(gid)) continue;
      seenGroups.add(gid);
    }
    blocks.push(toBusyBlock(b, role));
  }
  return blocks;
}

function viewToggleClass(active: boolean): string {
  return active
    ? "bg-primary text-primary-foreground"
    : "bg-muted text-muted-foreground hover:bg-muted/80";
}

/**
 * Month-grid view of every booking (past, present, and future), grouped by
 * day - the per-day chips are keyed off scheduledAt in local time. Used both
 * as a browse calendar (Beranda / Kalender Sesi) and, when `onSelect` is
 * supplied, as the Jadwalkan Sesi calendar with the same Bulan/Minggu chrome
 * plus slot selection in week view.
 */
export function BookingCalendar({
  includeCancelled = true,
  selected,
  onSelect,
  onBusyBlockClick,
  reloadToken = 0,
}: {
  includeCancelled?: boolean;
  selected?: SlotSelection | null;
  onSelect?: (selection: SlotSelection | null) => void;
  onBusyBlockClick?: (block: CalendarBusyBlock) => void;
  /** Bump to re-fetch bookings (e.g. after an inline booking edit). */
  reloadToken?: number;
}) {
  const router = useRouter();
  const { sessionUser } = useAuth();
  const scheduling = typeof onSelect === "function";
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("month");
  const [weekAnchor, setWeekAnchor] = useState<Date | null>(null);
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
  useEffect(refresh, [reloadToken]);

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
    () => coalesceBusyBlocks(visibleBookings, sessionUser?.role ?? null),
    [visibleBookings, sessionUser?.role],
  );

  function handleBusyClick(block: CalendarBusyBlock) {
    if (onBusyBlockClick) {
      onBusyBlockClick(block);
      return;
    }
    router.push(`/bookings/${block.bookingId}`);
  }

  function openWeekForDay(day: Date) {
    setWeekAnchor(day);
    setView("week");
  }

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
          selected={scheduling ? (selected ?? null) : null}
          onSelect={scheduling ? onSelect! : () => {}}
          allowPastSlots
          weekAnchor={weekAnchor}
          onBusyBlockClick={handleBusyClick}
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
              const dayDate = inMonth ? new Date(year, month, dayNum) : null;
              const key = dayDate ? dateKey(dayDate) : null;
              const items = key ? (byDate.get(key) ?? []) : [];

              return (
                <div
                  key={i}
                  role={scheduling && inMonth ? "button" : undefined}
                  tabIndex={scheduling && inMonth ? 0 : undefined}
                  onClick={
                    scheduling && dayDate
                      ? () => openWeekForDay(dayDate)
                      : undefined
                  }
                  onKeyDown={
                    scheduling && dayDate
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openWeekForDay(dayDate);
                          }
                        }
                      : undefined
                  }
                  className={`min-h-36 p-1.5 sm:min-h-40 sm:p-2 ${inMonth ? "bg-card" : "bg-muted"} ${
                    key === today ? "ring-2 ring-inset ring-primary" : ""
                  } ${scheduling && inMonth ? "cursor-pointer hover:bg-muted/40" : ""}`}
                >
                  {inMonth && (
                    <>
                      <span className="text-sm font-medium text-muted-foreground">{dayNum}</span>
                      <div className="mt-1.5 flex flex-col gap-1.5">
                        {(() => {
                          const seen = new Set<string>();
                          const displayItems = items.filter((b) => {
                            const gid = b.group?.id ?? b.groupId;
                            if (!gid) return true;
                            if (seen.has(gid)) return false;
                            seen.add(gid);
                            return true;
                          });
                          return displayItems.map((b) => {
                          const counterpart =
                            sessionUser?.role === "TUTOR" ? b.student.user : b.tutor.user;
                          const name =
                            sessionUser?.role === "TUTOR" && b.group && b.group.memberCount > 1
                              ? `Grup (${b.group.memberCount}): ${b.group.members.map((m) => m.studentName).join(", ")}`
                              : (counterpart?.name ?? "Pengguna");
                          const chipClass = `block w-full rounded-md border px-2 py-1.5 text-left ${bookingChipSurfaceClass(b.status)}`;
                          const notes = b.notes?.trim();
                          const chipBody = (
                            <>
                              <span
                                className={`block text-xs font-semibold leading-tight ${bookingChipTimeClass(b.status)}`}
                              >
                                {formatBookingTime(b.scheduledAt)}
                              </span>
                              <span className="mt-0.5 block truncate text-xs font-medium leading-tight text-foreground">
                                {name}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                                {b.subject.name}
                              </span>
                              {notes && (
                                <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                                  Catatan: {notes}
                                </span>
                              )}
                            </>
                          );
                          const title = formatBookingChipTitle(
                            name,
                            b.subject.name,
                            b.scheduledAt,
                            b.notes,
                          );

                          if (scheduling) {
                            return (
                              <button
                                key={b.id}
                                type="button"
                                title={title}
                                className={chipClass}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBusyClick(toBusyBlock(b, sessionUser?.role ?? null));
                                }}
                              >
                                {chipBody}
                              </button>
                            );
                          }

                          return (
                            <Link
                              key={b.id}
                              href={`/bookings/${b.id}`}
                              title={title}
                              className={chipClass}
                            >
                              {chipBody}
                            </Link>
                          );
                          });
                        })()}
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
