import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RatingStars } from "./RatingStars";

describe("RatingStars", () => {
  it("shows an empty-state message when there is no rating yet", () => {
    render(<RatingStars rating={null} />);
    expect(screen.getByText("Belum ada ulasan")).toBeInTheDocument();
  });

  it("renders the numeric rating and review count", () => {
    render(<RatingStars rating={4.5} count={12} />);
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
  });

  it("clamps out-of-range ratings to 0-5", () => {
    render(<RatingStars rating={7} />);
    expect(screen.getByLabelText("Rating 5.0 dari 5")).toBeInTheDocument();
  });
});
