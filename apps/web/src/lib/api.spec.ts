import { describe, expect, it, vi, beforeEach } from "vitest";

const getIdToken = vi.fn();

vi.mock("./firebase", () => ({
  firebaseAuth: {
    get currentUser() {
      return { getIdToken };
    },
  },
}));

describe("apiFetch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("attaches the current user's ID token as a Bearer header", async () => {
    getIdToken.mockResolvedValue("id-token-123");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    const { apiFetch } = await import("./api");
    await apiFetch("/tutors/me");

    const [, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((options.headers as Headers).get("Authorization")).toBe(
      "Bearer id-token-123",
    );
  });

  it("sets Content-Type to JSON when a body is present and none was specified", async () => {
    getIdToken.mockResolvedValue("id-token-123");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    const { apiFetch } = await import("./api");
    await apiFetch("/tutors/me", { method: "PATCH", body: JSON.stringify({ a: 1 }) });

    const [, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((options.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("does not force a Content-Type when the body is FormData", async () => {
    getIdToken.mockResolvedValue("id-token-123");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    const { apiFetch } = await import("./api");
    const formData = new FormData();
    formData.append("file", new Blob(["x"]), "ktp.jpg");
    await apiFetch("/tutors/me/documents/ktp", { method: "POST", body: formData });

    const [, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((options.headers as Headers).has("Content-Type")).toBe(false);
  });

  it("redirects to /login on a 401 response", async () => {
    getIdToken.mockResolvedValue("expired-token");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("{}", { status: 401 }),
    );

    // jsdom logs a "not implemented: navigation" error and doesn't actually
    // update window.location.href on assignment - replace it with a plain
    // mutable stand-in so the redirect is actually observable.
    const originalLocation = window.location;
    const locationMock = { href: "" };
    Object.defineProperty(window, "location", {
      value: locationMock,
      writable: true,
      configurable: true,
    });

    const { apiFetch } = await import("./api");
    await apiFetch("/tutors/me");

    expect(locationMock.href).toBe("/login");
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });
});
