import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { RoleSelector } from "./RoleSelector";

const setRole = vi.fn();

vi.mock("../lib/api", () => ({
  setRole: (...args: unknown[]) => setRole(...args),
}));

describe("RoleSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls setRole('STUDENT') and onSelected when the student card is chosen", async () => {
    setRole.mockResolvedValue({});
    const onSelected = vi.fn();
    render(<RoleSelector onSelected={onSelected} />);

    fireEvent.click(screen.getByText("Saya Siswa / Orang Tua"));

    await waitFor(() => expect(onSelected).toHaveBeenCalledOnce());
    expect(setRole).toHaveBeenCalledWith("STUDENT");
  });

  it("calls setRole('TUTOR') when the tutor card is chosen", async () => {
    setRole.mockResolvedValue({});
    const onSelected = vi.fn();
    render(<RoleSelector onSelected={onSelected} />);

    fireEvent.click(screen.getByText("Saya Tutor"));

    await waitFor(() => expect(onSelected).toHaveBeenCalledOnce());
    expect(setRole).toHaveBeenCalledWith("TUTOR");
  });

  it("shows an error and does not call onSelected when setRole fails", async () => {
    setRole.mockRejectedValue(new Error("conflict"));
    const onSelected = vi.fn();
    render(<RoleSelector onSelected={onSelected} />);

    fireEvent.click(screen.getByText("Saya Tutor"));

    expect(
      await screen.findByText("Gagal menyimpan pilihan. Silakan coba lagi."),
    ).toBeInTheDocument();
    expect(onSelected).not.toHaveBeenCalled();
  });
});
