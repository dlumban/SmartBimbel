import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AdminLoginForm } from "./AdminLoginForm";

const signInWithEmailAndPassword = vi.fn();
const signInWithPopup = vi.fn();

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: (...args: unknown[]) => signInWithEmailAndPassword(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  GoogleAuthProvider: vi.fn(),
}));

vi.mock("../lib/firebase", () => ({
  firebaseAuth: {},
}));

describe("AdminLoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has no self-registration option, unlike the student/tutor login", () => {
    render(<AdminLoginForm />);
    expect(screen.queryByText(/Daftar/)).not.toBeInTheDocument();
  });

  it("signs in with email/password and calls onSuccess", async () => {
    signInWithEmailAndPassword.mockResolvedValue({});
    const onSuccess = vi.fn();
    render(<AdminLoginForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith({}, "admin@example.com", "password123");
  });

  it("shows an error message when login fails", async () => {
    signInWithEmailAndPassword.mockRejectedValue(new Error("wrong password"));
    render(<AdminLoginForm />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    expect(await screen.findByText("Email atau kata sandi salah.")).toBeInTheDocument();
  });

  it("triggers Google sign-in on button click", async () => {
    signInWithPopup.mockResolvedValue({});
    const onSuccess = vi.fn();
    render(<AdminLoginForm onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole("button", { name: "Lanjutkan dengan Google" }));

    await waitFor(() => expect(signInWithPopup).toHaveBeenCalledOnce());
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
