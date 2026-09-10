"use client";

import { useMemo, useState } from "react";
import { ALLOWED_BOOKING_DURATIONS_MINUTES } from "@smartbimbel/shared";

const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const SLOT_MINUTES = 30;
const PIXELS_PER_SLOT = 52;
const DEFAULT_START_MINUTES = 8 * 60;
const DEFAULT_END_MINUTES = 21 * 60;
const MAX_SLOTS = Math.max(...ALLOWED_BOOKING_DURATIONS_MINUTES) / SLOT_MINUTES;

export interface BusyBlock {
  scheduledAt: string;
  durationMinutes: number;
  studentName?: string;
  subjectName?: string;
  completed?: boolean;
  cancelled?: boolean;
}

export interface SlotSelection {
  date: string; // "YYYY-MM-DD", local calendar date
  startTime: string; // "HH:MM", local wall-clock time
  slotCount: number; // duration = slotCount * 30 minutes
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function todayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDaysLocal(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeekLocal(d: Date): Date {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

// Local calendar date, not UTC - matches the "YYYY-MM-DD" scheduledDate the
// backend expects (interpreted in the tutor's own timezone), and there's no
// more recurring-slot weekday matching left to keep in sync with UTC math.
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
}

function slotRange(slot: SlotSelection): { start: number; end: number } {
  const start = toMinutes(slot.startTime);
  return { start, end: start + slot.slotCount * SLOT_MINUTES };
}

function slotsOverlap(a: SlotSelection, b: SlotSelection): boolean {
  if (a.date !== b.date) return false;
  const ra = slotRange(a);
  const rb = slotRange(b);
  return ra.start < rb.end && rb.start < ra.end;
}

function slotKey(slot: SlotSelection): string {
  return `${slot.date}|${slot.startTime}`;
}

export function formatSlotSelectionLabel(slot: SlotSelection): string {
  const end = minutesToTime(toMinutes(slot.startTime) + slot.slotCount * SLOT_MINUTES);
  return `${formatDateLabel(slot.date)}, ${slot.startTime}-${end}`;
}

export interface MultiSlotSelection {
  slots: SlotSelection[];
  slotCount: number;
  onToggle: (slot: SlotSelection) => void;
  onClear: () => void;
}

function formatBusyBlockTitle(block: BusyBlock, startMinutes: number, endMinutes: number): string {
  const time = `${minutesToTime(startMinutes)}-${minutesToTime(endMinutes)}`;
  const label = formatBusyBlockLabel(block);
  return label ? `${time} · ${label}` : time;
}

function formatBusyBlockLabel(block: BusyBlock): string | null {
  if (block.studentName && block.subjectName) {
    return `${block.studentName} · ${block.subjectName}`;
  }
  if (block.studentName) return block.studentName;
  if (block.subjectName) return block.subjectName;
  return null;
}

function BusyBlockContent({
  block,
  startMinutes,
  endMinutes,
}: {
  block: BusyBlock;
  startMinutes: number;
  endMinutes: number;
}) {
  const timeLabel = `${minutesToTime(startMinutes)}-${minutesToTime(endMinutes)}`;
  const slotCount = (endMinutes - startMinutes) / SLOT_MINUTES;

  if (block.studentName || block.subjectName) {
    return (
      <span className="flex min-h-0 flex-col justify-center gap-0.5">
        <span className="block truncate text-xs font-semibold leading-tight">
          {timeLabel}
        </span>
        {block.studentName && (
          <span className="block truncate text-xs font-medium leading-tight">
            {block.studentName}
          </span>
        )}
        {block.subjectName && slotCount >= 2 && (
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            {block.subjectName}
          </span>
        )}
      </span>
    );
  }

  return <span className="text-xs font-medium leading-tight">{timeLabel}</span>;
}

interface PositionedBusy<B extends BusyBlock> {
  block: B;
  startMinutes: number;
  endMinutes: number;
}

/**
 * Half-hour scheduling grid: a navigable week view where every cell is
 * either busy (an existing booking), past (no longer bookable unless
 * allowPastSlots), selected, or open. Clicking an open cell starts or
 * extends a contiguous selection; clicking a busy cell (if
 * `onBusyBlockClick` is supplied) hands the block back to the caller
 * instead of touching the selection. There's no more declared
 * availability to render - any future half-hour not already booked is
 * fair game.
 */
export function SchedulingCalendar<B extends BusyBlock>({
  busy,
  selected,
  onSelect,
  onBusyBlockClick,
  allowPastSlots = false,
  multiSelect,
}: {
  busy: B[];
  selected: SlotSelection | null;
  onSelect: (selection: SlotSelection | null) => void;
  onBusyBlockClick?: (block: B) => void;
  allowPastSlots?: boolean;
  multiSelect?: MultiSlotSelection;
}) {
  const thisWeekStart = useMemo(() => startOfWeekLocal(todayLocal()), []);
  const [weekStart, setWeekStart] = useState(thisWeekStart);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStart, i)),
    [weekStart],
  );

  const busyByDay = useMemo(() => {
    const map = new Map<string, PositionedBusy<B>[]>();
    for (const block of busy) {
      const start = new Date(block.scheduledAt);
      const key = dateKey(start);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      // Clipped to the same calendar day - a session is never created
      // spanning midnight through this calendar, so this only matters for
      // the rare booking made a different way; it just won't show the
      // overflow into the next day.
      const endMinutes = Math.min(24 * 60, startMinutes + block.durationMinutes);
      const list = map.get(key) ?? [];
      list.push({ block, startMinutes, endMinutes });
      map.set(key, list);
    }
    return map;
  }, [busy]);

  const { startMinutes, endMinutes } = useMemo(() => {
    const starts = [DEFAULT_START_MINUTES];
    const ends = [DEFAULT_END_MINUTES];
    for (const list of busyByDay.values()) {
      for (const b of list) {
        starts.push(b.startMinutes);
        ends.push(b.endMinutes);
      }
    }
    if (selected) {
      const selStart = toMinutes(selected.startTime);
      starts.push(selStart);
      ends.push(Math.min(24 * 60, selStart + selected.slotCount * SLOT_MINUTES));
    }
    if (multiSelect) {
      for (const slot of multiSelect.slots) {
        const selStart = toMinutes(slot.startTime);
        starts.push(selStart);
        ends.push(Math.min(24 * 60, selStart + slot.slotCount * SLOT_MINUTES));
      }
    }
    return {
      startMinutes: Math.max(0, Math.min(...starts) - SLOT_MINUTES),
      endMinutes: Math.min(24 * 60, Math.max(...ends) + SLOT_MINUTES),
    };
  }, [busyByDay, selected, multiSelect]);

  const cellStarts = useMemo(() => {
    const cells: number[] = [];
    for (let m = startMinutes; m < endMinutes; m += SLOT_MINUTES) cells.push(m);
    return cells;
  }, [startMinutes, endMinutes]);

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = Math.ceil(startMinutes / 60) * 60; m <= endMinutes; m += 60) marks.push(m);
    return marks;
  }, [startMinutes, endMinutes]);

  const gridHeight = (cellStarts.length * PIXELS_PER_SLOT) || PIXELS_PER_SLOT;
  const now = new Date();
  const todayKey = dateKey(todayLocal());

  function cellPast(day: Date, m: number): boolean {
    const instant = new Date(day);
    instant.setHours(Math.floor(m / 60), m % 60, 0, 0);
    return instant.getTime() <= now.getTime();
  }

  function handleOpenCellClick(day: string, m: number) {
    if (multiSelect) {
      const candidate: SlotSelection = {
        date: day,
        startTime: minutesToTime(m),
        slotCount: multiSelect.slotCount,
      };
      const existing = multiSelect.slots.find((slot) => slotKey(slot) === slotKey(candidate));
      if (existing) {
        multiSelect.onToggle(existing);
        return;
      }
      const candidateEnd = toMinutes(candidate.startTime) + candidate.slotCount * SLOT_MINUTES;
      if (candidateEnd > 24 * 60) return;
      const dayBusy = busyByDay.get(day) ?? [];
      const overlapsBusy = dayBusy.some(
        (pb) =>
          !pb.block.cancelled &&
          toMinutes(candidate.startTime) < pb.endMinutes &&
          candidateEnd > pb.startMinutes,
      );
      if (overlapsBusy) return;
      const overlapsSelected = multiSelect.slots.some((slot) => slotsOverlap(slot, candidate));
      if (overlapsSelected) return;
      multiSelect.onToggle(candidate);
      return;
    }

    if (!selected || selected.date !== day) {
      onSelect({ date: day, startTime: minutesToTime(m), slotCount: 1 });
      return;
    }
    const selStart = toMinutes(selected.startTime);
    const selEnd = selStart + selected.slotCount * SLOT_MINUTES;
    if (m === selStart - SLOT_MINUTES) {
      if (selected.slotCount >= MAX_SLOTS) return;
      onSelect({ date: day, startTime: minutesToTime(m), slotCount: selected.slotCount + 1 });
      return;
    }
    if (m === selEnd) {
      if (selected.slotCount >= MAX_SLOTS) return;
      onSelect({ ...selected, slotCount: selected.slotCount + 1 });
      return;
    }
    onSelect({ date: day, startTime: minutesToTime(m), slotCount: 1 });
  }

  const rangeLabel = `${days[0].getDate()} ${MONTH_LABELS[days[0].getMonth()]} - ${days[6].getDate()} ${MONTH_LABELS[days[6].getMonth()]} ${days[6].getFullYear()}`;

  const selectedEndTime = selected
    ? minutesToTime(toMinutes(selected.startTime) + selected.slotCount * SLOT_MINUTES)
    : null;

  function cellIsSelected(key: string, m: number): boolean {
    if (multiSelect) {
      return multiSelect.slots.some((slot) => {
        if (slot.date !== key) return false;
        const start = toMinutes(slot.startTime);
        const end = start + slot.slotCount * SLOT_MINUTES;
        return m >= start && m < end;
      });
    }
    return (
      selected !== null &&
      selected.date === key &&
      m >= toMinutes(selected.startTime) &&
      m < toMinutes(selected.startTime) + selected.slotCount * SLOT_MINUTES
    );
  }

  function cellBlockedBySelection(day: string, m: number): boolean {
    if (!multiSelect) return false;
    const probe: SlotSelection = {
      date: day,
      startTime: minutesToTime(m),
      slotCount: multiSelect.slotCount,
    };
    const probeEnd = toMinutes(probe.startTime) + probe.slotCount * SLOT_MINUTES;
    if (probeEnd > 24 * 60) return true;
    return multiSelect.slots.some(
      (slot) => slot.date === day && slotsOverlap(slot, probe) && slotKey(slot) !== slotKey(probe),
    );
  }

  return (
    <div className="flex w-full max-w-6xl flex-col gap-3">
      {multiSelect && multiSelect.slots.length > 0 && (
        <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
          <span>
            {multiSelect.slots.length} slot dipilih ({multiSelect.slotCount * SLOT_MINUTES} menit
            per sesi)
          </span>
          <button
            type="button"
            onClick={multiSelect.onClear}
            className="font-medium text-primary hover:underline"
          >
            Hapus semua
          </button>
        </div>
      )}

      {selected && selectedEndTime && !multiSelect && (
        <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
          <span>
            Dipilih: {formatDateLabel(selected.date)}, {selected.startTime}-{selectedEndTime} (
            {selected.slotCount * SLOT_MINUTES} menit)
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="font-medium text-primary hover:underline"
          >
            Hapus pilihan
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={!allowPastSlots && weekStart.getTime() <= thisWeekStart.getTime()}
          onClick={() => setWeekStart(addDaysLocal(weekStart, -7))}
          className="min-h-9 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted disabled:text-muted-foreground/50"
        >
          &larr; Minggu Sebelumnya
        </button>
        <span className="text-lg font-semibold text-foreground sm:text-xl">{rangeLabel}</span>
        <button
          type="button"
          onClick={() => setWeekStart(addDaysLocal(weekStart, 7))}
          className="min-h-9 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          Minggu Berikutnya &rarr;
        </button>
      </div>

      <div className="rounded-lg border border-border">
        <div className="grid grid-cols-[48px_repeat(7,1fr)] sm:grid-cols-[64px_repeat(7,1fr)]">
          <div />
          {days.map((day) => {
            const key = dateKey(day);
            const isPastDay = key < todayKey;
            return (
              <div
                key={key}
                className={`border-l border-border px-1.5 py-2.5 text-center text-sm font-medium ${
                  key === todayKey ? "bg-primary/10 text-primary" : "text-muted-foreground"
                } ${!allowPastSlots && isPastDay ? "opacity-40" : ""}`}
              >
                {WEEKDAY_LABELS[day.getDay()]} {day.getDate()}
              </div>
            );
          })}

          <div className="relative border-t border-border" style={{ height: gridHeight }}>
            {hourMarks.slice(0, -1).map((m) => (
              <div
                key={m}
                className="absolute right-1 -translate-y-2 text-right text-xs text-muted-foreground"
                style={{ top: ((m - startMinutes) / SLOT_MINUTES) * PIXELS_PER_SLOT }}
              >
                {minutesToTime(m)}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const key = dateKey(day);
            const positioned = busyByDay.get(key) ?? [];
            return (
              <div
                key={key}
                className="relative border-l border-t border-border"
                style={{ height: gridHeight }}
              >
                {cellStarts.map((m) =>
                  m > startMinutes ? (
                    <div
                      key={m}
                      className={`absolute w-full ${
                        m % 60 === 0 ? "border-t border-border" : "border-t border-border/50"
                      }`}
                      style={{ top: ((m - startMinutes) / SLOT_MINUTES) * PIXELS_PER_SLOT }}
                    />
                  ) : null,
                )}

                {positioned.map(({ block, startMinutes: bs, endMinutes: be }) => (
                  <button
                    key={`${key}-${bs}`}
                    type="button"
                    disabled={!onBusyBlockClick}
                    onClick={() => onBusyBlockClick?.(block)}
                    title={formatBusyBlockTitle(block, bs, be)}
                    className={`absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-md border px-2 py-1.5 text-left ${
                      block.cancelled
                        ? "border-destructive/40 bg-destructive/15 text-destructive"
                        : block.completed
                          ? "border-border/60 bg-muted/60 text-muted-foreground"
                          : onBusyBlockClick
                            ? "border-border bg-muted text-foreground hover:bg-muted-foreground/10"
                            : "border-input bg-muted text-muted-foreground"
                    }`}
                    style={{
                      top: ((bs - startMinutes) / SLOT_MINUTES) * PIXELS_PER_SLOT,
                      height: ((be - bs) / SLOT_MINUTES) * PIXELS_PER_SLOT,
                    }}
                  >
                    <BusyBlockContent block={block} startMinutes={bs} endMinutes={be} />
                  </button>
                ))}

                {cellStarts.map((m) => {
                  const covered = positioned.some(
                    (pb) => !pb.block.cancelled && m >= pb.startMinutes && m < pb.endMinutes,
                  );
                  if (covered) return null;
                  const past = !allowPastSlots && cellPast(day, m);
                  const blocked = cellBlockedBySelection(key, m);
                  const isSelected = cellIsSelected(key, m);
                  return (
                    <button
                      key={`${key}-open-${m}`}
                      type="button"
                      disabled={past || blocked}
                      onClick={() => handleOpenCellClick(key, m)}
                      title={minutesToTime(m)}
                      className={`absolute left-0.5 right-0.5 overflow-hidden rounded-sm border text-xs ${
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : past || blocked
                            ? "border-transparent bg-muted"
                            : "border-transparent hover:border-primary/40 hover:bg-primary/10"
                      }`}
                      style={{
                        top: ((m - startMinutes) / SLOT_MINUTES) * PIXELS_PER_SLOT,
                        height: PIXELS_PER_SLOT,
                      }}
                    >
                      {isSelected ? minutesToTime(m) : ""}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
