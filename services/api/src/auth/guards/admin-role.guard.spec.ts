import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AdminRoleGuard } from "./admin-role.guard";

function makeContext(user: { adminRole: string | null }): ExecutionContext {
  const request = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("AdminRoleGuard", () => {
  it("allows access when the route has no @AdminRoles() restriction", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const guard = new AdminRoleGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(makeContext({ adminRole: "SUPPORT" }))).toBe(true);
  });

  it("allows access when the user's adminRole is in the required list", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["SUPER_ADMIN"]) };
    const guard = new AdminRoleGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(makeContext({ adminRole: "SUPER_ADMIN" }))).toBe(true);
  });

  it("throws ForbiddenException when a SUPPORT admin hits a SUPER_ADMIN-only route", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["SUPER_ADMIN"]) };
    const guard = new AdminRoleGuard(reflector as unknown as Reflector);
    expect(() => guard.canActivate(makeContext({ adminRole: "SUPPORT" }))).toThrow(
      ForbiddenException,
    );
  });

  it("throws ForbiddenException when the user has no adminRole at all", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["SUPER_ADMIN"]) };
    const guard = new AdminRoleGuard(reflector as unknown as Reflector);
    expect(() => guard.canActivate(makeContext({ adminRole: null }))).toThrow(
      ForbiddenException,
    );
  });
});
