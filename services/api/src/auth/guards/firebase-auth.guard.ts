import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { User } from "@prisma/client";
import { FirebaseAdminService } from "../firebase-admin.service";
import { PrismaService } from "../../prisma/prisma.service";

export interface AuthenticatedRequest extends Request {
  user: User;
}

/**
 * Verifies the Bearer token on every protected route and attaches the
 * resolved platform User to the request. A valid Firebase token for a UID
 * with no matching User row is still rejected (401) - that should only
 * happen for tokens that were never exchanged via POST /auth/session first.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    let decoded;
    try {
      decoded = await this.firebaseAdmin.verifyIdToken(token);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      throw new UnauthorizedException("Invalid or expired authentication token.");
    }

    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });

    if (!user) {
      throw new UnauthorizedException("No account found for this token.");
    }

    if (user.status === "SUSPENDED") {
      throw new UnauthorizedException("This account has been suspended.");
    }

    request.user = user;
    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    return header.slice("Bearer ".length).trim() || null;
  }
}
