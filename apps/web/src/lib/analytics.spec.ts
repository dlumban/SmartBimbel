import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const getAnalytics = vi.fn();
const isSupported = vi.fn();
const logEvent = vi.fn();
vi.mock("firebase/analytics", () => ({
  getAnalytics: (...args: unknown[]) => getAnalytics(...args),
  isSupported: (...args: unknown[]) => isSupported(...args),
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

describe("trackEvent", () => {
  const originalMeasurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = originalMeasurementId;
  });

  it("does nothing when Firebase isn't configured (no app)", async () => {
    vi.doMock("./firebase", () => ({ firebaseApp: null }));
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = "G-TEST123";
    const { trackEvent } = await import("./analytics");

    await trackEvent("sign_up", { method: "password" });

    expect(getAnalytics).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("does nothing when NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID isn't set", async () => {
    vi.doMock("./firebase", () => ({ firebaseApp: {} }));
    delete process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
    const { trackEvent } = await import("./analytics");

    await trackEvent("sign_up", { method: "password" });

    expect(getAnalytics).not.toHaveBeenCalled();
  });

  it("does nothing when the environment doesn't support Analytics", async () => {
    vi.doMock("./firebase", () => ({ firebaseApp: {} }));
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = "G-TEST123";
    isSupported.mockResolvedValue(false);
    const { trackEvent } = await import("./analytics");

    await trackEvent("sign_up", { method: "password" });

    expect(getAnalytics).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("logs the event when fully configured and supported", async () => {
    const fakeApp = {};
    const fakeAnalytics = { app: fakeApp };
    vi.doMock("./firebase", () => ({ firebaseApp: fakeApp }));
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = "G-TEST123";
    isSupported.mockResolvedValue(true);
    getAnalytics.mockReturnValue(fakeAnalytics);
    const { trackEvent } = await import("./analytics");

    await trackEvent("role_selected", { role: "STUDENT" });

    expect(getAnalytics).toHaveBeenCalledWith(fakeApp);
    expect(logEvent).toHaveBeenCalledWith(fakeAnalytics, "role_selected", { role: "STUDENT" });
  });
});
