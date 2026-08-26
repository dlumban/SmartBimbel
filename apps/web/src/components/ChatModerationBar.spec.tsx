import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatModerationBar } from "./ChatModerationBar";

describe("ChatModerationBar", () => {
  it("shows the on-platform payment reminder without report/block actions", () => {
    render(<ChatModerationBar />);
    expect(screen.getByText(/selalu lakukan pembayaran dan komunikasi utama/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Laporkan Pengguna" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Blokir Pengguna" })).not.toBeInTheDocument();
  });
});
