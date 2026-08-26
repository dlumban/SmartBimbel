import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { AuthenticatedRequest } from "./firebase-auth.guard";

/**
 * Must run after FirebaseAuthGuard (relies on request.user already being
 * set). Routes with no @Roles() decorator are allowed through untouched -
 * this guard only restricts routes that explicitly opt in.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        "You do not have permission to access this resource.",
      );
    }

    return true;
  }
}
