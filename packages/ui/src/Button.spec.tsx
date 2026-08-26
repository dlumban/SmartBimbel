import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its label and responds to clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Book Now</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Book Now" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Book Now
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Book Now" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
