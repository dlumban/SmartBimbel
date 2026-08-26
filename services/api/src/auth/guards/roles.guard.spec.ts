import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

function makeContext(user: { role: string | null }): ExecutionContext {
  const request = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows access when the route has no @Roles() restriction", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(makeContext({ role: "STUDENT" }))).toBe(true);
  });

  it("allows access when the user's role is in the required list", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(makeContext({ role: "ADMIN" }))).toBe(true);
  });

  it("throws ForbiddenException when the user's role isn't in the required list", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(() => guard.canActivate(makeContext({ role: "STUDENT" }))).toThrow(
      ForbiddenException,
    );
  });

  it("throws ForbiddenException when the user has no role at all", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(() => guard.canActivate(makeContext({ role: null }))).toThrow(
      ForbiddenException,
    );
  });
});
