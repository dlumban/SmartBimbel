import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AccessLinkRedeemer } from "./AccessLinkRedeemer";

const signInWithCustomToken = vi.fn();
vi.mock("firebase/auth", () => ({
  signInWithCustomToken: (...args: unknown[]) => signInWithCustomToken(...args),
}));

vi.mock("../lib/firebase", () => ({
  firebaseAuth: {},
}));

const redeemAccessLink = vi.fn();
vi.mock("../lib/api", () => ({
  redeemAccessLink: (...args: unknown[]) => redeemAccessLink(...args),
}));

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("AccessLinkRedeemer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redeems the token, signs in with the resulting custom token, and redirects home", async () => {
    redeemAccessLink.mockResolvedValue({ customToken: "custom-token-1" });
    signInWithCustomToken.mockResolvedValue({});

    render(<AccessLinkRedeemer token="abc123" />);

    expect(screen.getByText("Memproses link akses...")).toBeInTheDocument();

    await waitFor(() => expect(redeemAccessLink).toHaveBeenCalledWith("abc123"));
    await waitFor(() =>
      expect(signInWithCustomToken).toHaveBeenCalledWith({}, "custom-token-1"),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("shows an error and a manual sign-in link when the link is invalid or expired", async () => {
    redeemAccessLink.mockRejectedValue(new Error("This link is invalid or has expired."));

    render(<AccessLinkRedeemer token="bad-token" />);

    expect(
      await screen.findByText("This link is invalid or has expired."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Masuk secara manual" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(signInWithCustomToken).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows an error when the sign-in step itself fails", async () => {
    redeemAccessLink.mockResolvedValue({ customToken: "custom-token-1" });
    signInWithCustomToken.mockRejectedValue(new Error("Firebase: invalid custom token."));

    render(<AccessLinkRedeemer token="abc123" />);

    expect(
      await screen.findByText("Firebase: invalid custom token."),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
