import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BusyBlock, SchedulingCalendar, SlotSelection } from "./SchedulingCalendar";

// Fixed "now" early in the morning so every half-hour cell later that day
// (the default 08:00-21:00 window) reads as open/future, regardless of
// which weekday the suite happens to run on.
const TODAY = new Date(2026, 7, 10, 0, 5, 0);
const DAY_INDEX = TODAY.getDay(); // position of "today" within the Sun-first week grid

function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface EditableBusyBlock extends BusyBlock {
  id: string;
}

function Harness({
  busy = [],
  onBusyBlockClick,
}: {
  busy?: EditableBusyBlock[];
  onBusyBlockClick?: (block: EditableBusyBlock) => void;
}) {
  const [selected, setSelected] = useState<SlotSelection | null>(null);
  return (
    <SchedulingCalendar busy={busy} selected={selected} onSelect={setSelected} onBusyBlockClick={onBusyBlockClick} />
  );
}

describe("SchedulingCalendar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a 1-slot selection when an open cell is clicked", () => {
    const onSelect = vi.fn();
    render(<SchedulingCalendar busy={[]} selected={null} onSelect={onSelect} />);

    fireEvent.click(screen.getAllByTitle("08:00")[DAY_INDEX]);

    expect(onSelect).toHaveBeenCalledWith({
      date: dateKeyOf(TODAY),
      startTime: "08:00",
      slotCount: 1,
    });
  });

  it("extends the selection when an adjacent open cell is clicked, in either direction", () => {
    render(<Harness />);

    fireEvent.click(screen.getAllByTitle("08:00")[DAY_INDEX]);
    fireEvent.click(screen.getAllByTitle("08:30")[DAY_INDEX]);
    expect(screen.getByText(/08:00-09:00 \(60 menit\)/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle("07:30")[DAY_INDEX]);
    expect(screen.getByText(/07:30-09:00 \(90 menit\)/)).toBeInTheDocument();
  });

  it("restarts a fresh 1-slot selection when a non-adjacent open cell is clicked", () => {
    render(<Harness />);

    fireEvent.click(screen.getAllByTitle("08:00")[DAY_INDEX]);
    fireEvent.click(screen.getAllByTitle("08:30")[DAY_INDEX]);
    expect(screen.getByText(/08:00-09:00 \(60 menit\)/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle("10:00")[DAY_INDEX]);
    expect(screen.getByText(/10:00-10:30 \(30 menit\)/)).toBeInTheDocument();
  });

  it("stops extension at a busy cell instead of skipping over it", () => {
    const busy: EditableBusyBlock[] = [
      {
        id: "b1",
        scheduledAt: new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate(), 9, 0).toISOString(),
        durationMinutes: 30,
      },
    ];
    render(<Harness busy={busy} />);

    fireEvent.click(screen.getAllByTitle("08:00")[DAY_INDEX]);
    fireEvent.click(screen.getAllByTitle("08:30")[DAY_INDEX]);
    expect(screen.getByText(/08:00-09:00 \(60 menit\)/)).toBeInTheDocument();

    // The 09:00 half-hour is occupied by the busy block, so it never
    // renders as a clickable open cell in today's column - only the other
    // 6 day columns still offer one.
    expect(screen.getAllByTitle("09:00")).toHaveLength(6);

    // Clicking the busy block itself (no onBusyBlockClick supplied) is a
    // no-op - the selection must stay exactly where it stopped.
    fireEvent.click(screen.getByTitle("09:00-09:30"));
    expect(screen.getByText(/08:00-09:00 \(60 menit\)/)).toBeInTheDocument();
  });

  it("clears the selection when Hapus pilihan is clicked", () => {
    render(<Harness />);

    fireEvent.click(screen.getAllByTitle("08:00")[DAY_INDEX]);
    expect(screen.getByText(/08:00-08:30 \(30 menit\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hapus pilihan" }));
    expect(screen.queryByText(/Dipilih:/)).not.toBeInTheDocument();
  });

  it("fires onBusyBlockClick with the block when supplied", () => {
    const onBusyBlockClick = vi.fn();
    const block: EditableBusyBlock = {
      id: "b1",
      scheduledAt: new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate(), 9, 0).toISOString(),
      durationMinutes: 30,
    };
    render(<Harness busy={[block]} onBusyBlockClick={onBusyBlockClick} />);

    fireEvent.click(screen.getByTitle("09:00-09:30"));
    expect(onBusyBlockClick).toHaveBeenCalledWith(block);
  });

  it("renders the busy block as inert when onBusyBlockClick is not supplied", () => {
    const block: EditableBusyBlock = {
      id: "b1",
      scheduledAt: new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate(), 9, 0).toISOString(),
      durationMinutes: 30,
    };
    render(<SchedulingCalendar busy={[block]} selected={null} onSelect={vi.fn()} />);

    expect(screen.getByTitle("09:00-09:30")).toBeDisabled();
  });
});
