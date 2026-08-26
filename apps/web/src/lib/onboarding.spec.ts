import { describe, expect, it } from "vitest";
import { getOnboardingRedirect } from "./onboarding";
import { SessionUser } from "./api";

function user(overrides: Partial<SessionUser>): SessionUser {
  return {
    id: "u1",
    name: null,
    role: null,
    phone: null,
    email: null,
    status: "ACTIVE",
    hasProfile: false,
    ...overrides,
  };
}

describe("getOnboardingRedirect", () => {
  it("returns null for a logged-out user (caller sends them to /login separately)", () => {
    expect(getOnboardingRedirect(null)).toBeNull();
  });

  it("routes to role selection when no role is set", () => {
    expect(getOnboardingRedirect(user({ role: null }))).toBe("/onboarding/role");
  });

  it("routes to profile setup when role is set but no profile exists", () => {
    expect(getOnboardingRedirect(user({ role: "STUDENT", hasProfile: false }))).toBe(
      "/onboarding/profile",
    );
  });

  it("returns null (stay put) once role and profile are both set", () => {
    expect(getOnboardingRedirect(user({ role: "STUDENT", hasProfile: true }))).toBeNull();
  });
});
