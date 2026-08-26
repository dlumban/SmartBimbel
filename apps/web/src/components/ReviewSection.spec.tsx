import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReviewSection } from "./ReviewSection";

const getReview = vi.fn();
const submitReview = vi.fn();
vi.mock("../lib/reviews", async () => {
  const actual = await vi.importActual<typeof import("../lib/reviews")>("../lib/reviews");
  return {
    ...actual,
    getReview: (...args: unknown[]) => getReview(...args),
    submitReview: (...args: unknown[]) => submitReview(...args),
  };
});

describe("ReviewSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a rating/text form when no review exists yet", async () => {
    getReview.mockResolvedValue(null);
    render(<ReviewSection bookingId="b1" />);

    expect(await screen.findByText("Beri Ulasan")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Rating" })).toBeInTheDocument();
  });

  it("submits a rating and optional text", async () => {
    getReview.mockResolvedValue(null);
    submitReview.mockResolvedValue({
      id: "r1",
      rating: 4,
      text: "Cukup bagus",
      flagged: false,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    render(<ReviewSection bookingId="b1" />);

    await screen.findByText("Beri Ulasan");
    fireEvent.click(screen.getByRole("radio", { name: "4 bintang" }));
    fireEvent.change(screen.getByLabelText("Ulasan (opsional)"), {
      target: { value: "Cukup bagus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim Ulasan" }));

    await waitFor(() =>
      expect(submitReview).toHaveBeenCalledWith("b1", { rating: 4, text: "Cukup bagus" }),
    );
    expect(await screen.findByText("Ulasan Anda")).toBeInTheDocument();
  });

  it("shows an existing review with an edit option instead of the form", async () => {
    getReview.mockResolvedValue({
      id: "r1",
      rating: 5,
      text: "Luar biasa",
      flagged: false,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    render(<ReviewSection bookingId="b1" />);

    expect(await screen.findByText("Ulasan Anda")).toBeInTheDocument();
    expect(screen.getByText("Luar biasa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ubah Ulasan" })).toBeInTheDocument();
  });

  it("shows the server's error message when the edit window has closed", async () => {
    getReview.mockResolvedValue({
      id: "r1",
      rating: 5,
      text: "Luar biasa",
      flagged: false,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    submitReview.mockRejectedValue(new Error("This review is locked - it can only be edited within 48 hours of submission."));
    render(<ReviewSection bookingId="b1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Ubah Ulasan" }));
    fireEvent.click(screen.getByRole("button", { name: "Kirim Ulasan" }));

    expect(
      await screen.findByText(
        "This review is locked - it can only be edited within 48 hours of submission.",
      ),
    ).toBeInTheDocument();
  });
});
