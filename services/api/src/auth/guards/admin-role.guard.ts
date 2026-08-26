import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AdminRole } from "@prisma/client";
import { ADMIN_ROLES_KEY } from "../decorators/admin-roles.decorator";
import { AuthenticatedRequest } from "./firebase-auth.guard";

/**
 * Sub-role check on top of RolesGuard's ADMIN check (Task 7.1) - routes
 * with no @AdminRoles() decorator are allowed through untouched, same
 * "opt-in only" convention as RolesGuard. Must run after both
 * FirebaseAuthGuard and RolesGuard so request.user is set and already
 * confirmed to be an ADMIN.
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAdminRoles = this.reflector.getAllAndOverride<AdminRole[] | undefined>(
      ADMIN_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredAdminRoles || requiredAdminRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user.adminRole || !requiredAdminRoles.includes(user.adminRole)) {
      throw new ForbiddenException(
        "Your admin role does not have permission to perform this action.",
      );
    }

    return true;
  }
}
