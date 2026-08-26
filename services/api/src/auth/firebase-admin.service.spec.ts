import { ConfigService } from "@nestjs/config";
import { FirebaseAdminService } from "./firebase-admin.service";

function makeService(env: Record<string, string | undefined>): FirebaseAdminService {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return new FirebaseAdminService(config);
}

function encodeBypassToken(payload: Record<string, unknown>): string {
  return `E2E.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

describe("FirebaseAdminService - E2E auth bypass", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("falls through to real Firebase verification when E2E_AUTH_BYPASS_SECRET isn't set", async () => {
    process.env.NODE_ENV = "test";
    const service = makeService({});
    await expect(service.verifyIdToken("E2E.anything")).rejects.toThrow();
  });

  it("falls through to real Firebase verification for tokens without the E2E. prefix, even when bypass is configured", async () => {
    process.env.NODE_ENV = "test";
    const service = makeService({ E2E_AUTH_BYPASS_SECRET: "s3cret" });
    await expect(service.verifyIdToken("some-real-looking-token")).rejects.toThrow();
  });

  it("refuses to bypass when NODE_ENV is production, even with a configured secret and valid token", async () => {
    process.env.NODE_ENV = "production";
    const service = makeService({ E2E_AUTH_BYPASS_SECRET: "s3cret" });
    const token = encodeBypassToken({ secret: "s3cret", uid: "e2e-uid-1" });
    await expect(service.verifyIdToken(token)).rejects.toThrow();
  });

  it("rejects a bypass token with the wrong secret", async () => {
    process.env.NODE_ENV = "test";
    const service = makeService({ E2E_AUTH_BYPASS_SECRET: "s3cret" });
    const token = encodeBypassToken({ secret: "wrong", uid: "e2e-uid-1" });
    await expect(service.verifyIdToken(token)).rejects.toThrow("Invalid E2E bypass token.");
  });

  it("rejects a malformed bypass token", async () => {
    process.env.NODE_ENV = "test";
    const service = makeService({ E2E_AUTH_BYPASS_SECRET: "s3cret" });
    await expect(service.verifyIdToken("E2E.not-valid-base64json!!!")).rejects.toThrow(
      "Malformed E2E bypass token.",
    );
  });

  it("resolves a valid bypass token to a decoded-token-shaped object without touching real Firebase", async () => {
    process.env.NODE_ENV = "test";
    const service = makeService({ E2E_AUTH_BYPASS_SECRET: "s3cret" });
    const token = encodeBypassToken({
      secret: "s3cret",
      uid: "e2e-uid-1",
      email: "e2e@example.com",
    });

    const decoded = await service.verifyIdToken(token);

    expect(decoded.uid).toBe("e2e-uid-1");
    expect(decoded.email).toBe("e2e@example.com");
  });
});

describe("FirebaseAdminService - createCustomToken", () => {
  it("throws when Firebase Admin isn't configured", async () => {
    const service = makeService({});
    await expect(service.createCustomToken("user-1")).rejects.toThrow();
  });
});
