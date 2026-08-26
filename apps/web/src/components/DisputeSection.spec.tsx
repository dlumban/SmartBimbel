import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DisputeSection } from "./DisputeSection";

const raiseDispute = vi.fn();
vi.mock("../lib/disputes", async () => {
  const actual = await vi.importActual<typeof import("../lib/disputes")>("../lib/disputes");
  return { ...actual, raiseDispute: (...args: unknown[]) => raiseDispute(...args) };
});

describe("DisputeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits a dispute with a reason and shows confirmation", async () => {
    raiseDispute.mockResolvedValue({ id: "d1", status: "OPEN" });

    render(<DisputeSection bookingId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajukan Sengketa" }));
    fireEvent.change(screen.getByLabelText("Jelaskan masalahnya"), {
      target: { value: "Tutor tidak hadir tanpa kabar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim Sengketa" }));

    await waitFor(() =>
      expect(raiseDispute).toHaveBeenCalledWith("b1", "Tutor tidak hadir tanpa kabar"),
    );
    expect(
      await screen.findByText("Sengketa Anda telah dikirim dan akan ditinjau oleh tim kami."),
    ).toBeInTheDocument();
  });

  it("rejects submitting with no reason", async () => {
    render(<DisputeSection bookingId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajukan Sengketa" }));
    fireEvent.click(screen.getByRole("button", { name: "Kirim Sengketa" }));

    expect(await screen.findByText("Jelaskan masalah yang Anda alami.")).toBeInTheDocument();
    expect(raiseDispute).not.toHaveBeenCalled();
  });

  it("shows an error message when the API call fails", async () => {
    raiseDispute.mockRejectedValue(new Error("You are not a participant in this booking."));

    render(<DisputeSection bookingId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajukan Sengketa" }));
    fireEvent.change(screen.getByLabelText("Jelaskan masalahnya"), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim Sengketa" }));

    expect(
      await screen.findByText("You are not a participant in this booking."),
    ).toBeInTheDocument();
  });

  it("closes the form on cancel without submitting", () => {
    render(<DisputeSection bookingId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajukan Sengketa" }));
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));

    expect(screen.queryByLabelText("Jelaskan masalahnya")).not.toBeInTheDocument();
    expect(raiseDispute).not.toHaveBeenCalled();
  });
});
