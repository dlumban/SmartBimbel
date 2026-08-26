import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SessionCompletionSection } from "./SessionCompletionSection";

const completeBooking = vi.fn();
vi.mock("../lib/bookings", async () => {
  const actual = await vi.importActual<typeof import("../lib/bookings")>("../lib/bookings");
  return { ...actual, completeBooking: (...args: unknown[]) => completeBooking(...args) };
});

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    ...overrides,
  };
}

describe("SessionCompletionSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables the button before the session has occurred", () => {
    render(
      <SessionCompletionSection
        booking={makeBooking({ scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }) as never}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Tandai Selesai" })).toBeDisabled();
    expect(screen.getByText("Tombol ini akan aktif setelah waktu sesi berakhir.")).toBeInTheDocument();
  });

  it("enables the button and completes the session once it has occurred", async () => {
    const onUpdated = vi.fn();
    completeBooking.mockResolvedValue({ id: "b1", status: "COMPLETED" });
    render(<SessionCompletionSection booking={makeBooking() as never} onUpdated={onUpdated} />);

    const button = screen.getByRole("button", { name: "Tandai Selesai" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    await waitFor(() => expect(completeBooking).toHaveBeenCalledWith("b1"));
    expect(onUpdated).toHaveBeenCalledWith({ id: "b1", status: "COMPLETED" });
  });

  it("shows an error message when completion fails", async () => {
    completeBooking.mockRejectedValue(new Error("Cannot complete a booking in ACCEPTED state."));
    render(<SessionCompletionSection booking={makeBooking() as never} onUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Tandai Selesai" }));

    expect(
      await screen.findByText("Cannot complete a booking in ACCEPTED state."),
    ).toBeInTheDocument();
  });
});
