import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizePhoneToE164 } from "../common/phone.util";
import { FirebaseAdminService } from "./firebase-admin.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verifies a Firebase ID token (issued after phone OTP, Google, or
   * email/password sign-in - all three flows converge on this one method)
   * and upserts the corresponding platform User, creating it on first login.
   */
  async exchangeToken(idToken: string): Promise<User> {
    const decoded = await this.verifyToken(idToken);

    const phone = decoded.phone_number
      ? normalizePhoneToE164(decoded.phone_number)
      : null;

    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });

    if (existing) {
      // Keep phone/email in sync in case they changed on the Firebase side
      // (e.g. user added an email to a phone-first account).
      if (
        (phone && phone !== existing.phone) ||
        (decoded.email && decoded.email !== existing.email)
      ) {
        return this.prisma.user.update({
          where: { id: existing.id },
          data: {
            phone: phone ?? existing.phone,
            email: decoded.email ?? existing.email,
          },
        });
      }
      return existing;
    }

    // An admin may have pre-created this person as a Student (Add Student,
    // admin panel) before they ever signed in - that row has no
    // firebaseUid yet. Claim it by phone/email on their first real login
    // instead of creating a duplicate account (phone/email are unique, so
    // an unconditional create would otherwise throw).
    const claimable = await this.findClaimableUser(phone, decoded.email ?? null);
    if (claimable) {
      return this.prisma.user.update({
        where: { id: claimable.id },
        data: {
          firebaseUid: decoded.uid,
          phone: phone ?? claimable.phone,
          email: decoded.email ?? claimable.email,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        firebaseUid: decoded.uid,
        phone,
        email: decoded.email ?? null,
      },
    });
  }

  private async findClaimableUser(phone: string | null, email: string | null) {
    if (!phone && !email) return null;
    return this.prisma.user.findFirst({
      where: {
        firebaseUid: null,
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });
  }

  private async verifyToken(idToken: string) {
    try {
      return await this.firebaseAdmin.verifyIdToken(idToken);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      throw new UnauthorizedException("Invalid or expired authentication token.");
    }
  }
}
