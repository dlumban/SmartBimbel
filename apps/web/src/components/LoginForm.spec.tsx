import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LoginForm } from "./LoginForm";

const signInWithPopup = vi.fn();

vi.mock("firebase/auth", () => ({
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  GoogleAuthProvider: vi.fn(),
}));

vi.mock("../lib/firebase", () => ({
  firebaseAuth: {},
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers Google sign-in on button click and calls onSuccess", async () => {
    signInWithPopup.mockResolvedValue({});
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole("button", { name: "Lanjutkan dengan Google" }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalledOnce());
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("shows a Firebase error code when Google sign-in fails", async () => {
    signInWithPopup.mockRejectedValue({ code: "auth/popup-blocked" });
    render(<LoginForm />);

    fireEvent.click(screen.getByRole("button", { name: "Lanjutkan dengan Google" }));

    expect(
      await screen.findByText("Popup Google diblokir browser. Izinkan popup lalu coba lagi."),
    ).toBeInTheDocument();
  });

  it("does not show email or password fields", () => {
    render(<LoginForm />);
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Kata sandi")).not.toBeInTheDocument();
  });
});
