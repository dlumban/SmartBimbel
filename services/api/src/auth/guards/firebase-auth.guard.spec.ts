import { ExecutionContext, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { FirebaseAuthGuard } from "./firebase-auth.guard";
import { FirebaseAdminService } from "../firebase-admin.service";
import { PrismaService } from "../../prisma/prisma.service";

function makeContext(headers: Record<string, string>): ExecutionContext {
  const request: Record<string, unknown> = { headers, user: undefined };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe("FirebaseAuthGuard", () => {
  let firebaseAdmin: { verifyIdToken: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };
  let guard: FirebaseAuthGuard;

  beforeEach(() => {
    firebaseAdmin = { verifyIdToken: jest.fn() };
    prisma = { user: { findUnique: jest.fn() } };
    guard = new FirebaseAuthGuard(
      firebaseAdmin as unknown as FirebaseAdminService,
      prisma as unknown as PrismaService,
    );
  });

  it("rejects a request with no Authorization header", async () => {
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a malformed Authorization header", async () => {
    const ctx = makeContext({ authorization: "Basic abc123" });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a token Firebase can't verify", async () => {
    firebaseAdmin.verifyIdToken.mockRejectedValue(new Error("bad token"));
    const ctx = makeContext({ authorization: "Bearer bad-token" });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("propagates 503 when Firebase Admin isn't configured", async () => {
    firebaseAdmin.verifyIdToken.mockRejectedValue(
      new ServiceUnavailableException("not configured"),
    );
    const ctx = makeContext({ authorization: "Bearer any-token" });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ServiceUnavailableException);
  });

  it("rejects a valid token with no matching platform user", async () => {
    firebaseAdmin.verifyIdToken.mockResolvedValue({ uid: "fb-1" });
    prisma.user.findUnique.mockResolvedValue(null);
    const ctx = makeContext({ authorization: "Bearer good-token" });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a suspended user", async () => {
    firebaseAdmin.verifyIdToken.mockResolvedValue({ uid: "fb-1" });
    prisma.user.findUnique.mockResolvedValue({ id: "u1", status: "SUSPENDED" });
    const ctx = makeContext({ authorization: "Bearer good-token" });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("attaches the user to the request and allows access", async () => {
    const user = { id: "u1", status: "ACTIVE", role: "STUDENT" };
    firebaseAdmin.verifyIdToken.mockResolvedValue({ uid: "fb-1" });
    prisma.user.findUnique.mockResolvedValue(user);
    const request: Record<string, unknown> = {
      headers: { authorization: "Bearer good-token" },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.user).toBe(user);
  });
});
