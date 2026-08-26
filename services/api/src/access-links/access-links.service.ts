import { randomBytes, createHash } from "crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { FirebaseAdminService } from "../auth/firebase-admin.service";
import { AuditLogService } from "../audit-log/audit-log.service";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AccessLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  // Lets an admin hand a student a working sign-in link with no Firebase
  // account needed on their end - the primary use case is a student added
  // via "Add Student" (firebaseUid still null), but works for any STUDENT.
  async generate(
    admin: User,
    studentUserId: string,
  ): Promise<{ token: string; url: string }> {
    const student = await this.requireStudent(studentUserId);
    return this.issueLink(admin.id, student);
  }

  // Tutor-scoped equivalent of generate() - a tutor may only mint a link for
  // a student they themselves added (Prisma.User.addedByTutorId), never for
  // any other student in the system, admin-created or otherwise.
  async generateForTutor(
    tutor: User,
    studentUserId: string,
  ): Promise<{ token: string; url: string }> {
    const student = await this.requireOwnedStudent(tutor, studentUserId);
    return this.issueLink(tutor.id, student);
  }

  async deactivate(admin: User, studentUserId: string): Promise<{ deactivated: number }> {
    await this.requireStudent(studentUserId);
    return this.deactivateActiveLinks(admin.id, studentUserId);
  }

  async deactivateForTutor(
    tutor: User,
    studentUserId: string,
  ): Promise<{ deactivated: number }> {
    await this.requireOwnedStudent(tutor, studentUserId);
    return this.deactivateActiveLinks(tutor.id, studentUserId);
  }

  private async requireStudent(id: string): Promise<User> {
    const student = await this.prisma.user.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException("No user with that id exists.");
    }
    if (student.role !== "STUDENT") {
      throw new BadRequestException("Access links can only be generated for a STUDENT account.");
    }
    return student;
  }

  private async requireOwnedStudent(tutor: User, studentUserId: string): Promise<User> {
    const student = await this.requireStudent(studentUserId);
    if (student.addedByTutorId !== tutor.id) {
      throw new ForbiddenException("You can only manage access links for students you added.");
    }
    return student;
  }

  // The raw token is returned exactly once, here; only its hash is ever
  // stored. Minting a new link deactivates any previous active links for
  // this student so only the latest one works.
  private async issueLink(
    actorId: string,
    student: User,
  ): Promise<{ token: string; url: string }> {
    const rawToken = randomBytes(32).toString("base64url");

    await this.prisma.accessLink.updateMany({
      where: { userId: student.id, deactivatedAt: null },
      data: { deactivatedAt: new Date() },
    });

    await this.prisma.accessLink.create({
      data: { userId: student.id, tokenHash: hashToken(rawToken) },
    });

    await this.auditLog.log(actorId, "user.generate_access_link", "User", student.id, {});

    // WEB_APP_URL is a fallback for non-browser callers. Web/admin UIs rebuild
    // the absolute URL from window.location.origin so Cloudflare tunnel (and
    // any other temporary host) matches the domain the admin is actually on.
    const webAppUrl = this.config.get<string>("WEB_APP_URL") ?? "http://localhost:3000";
    return {
      token: rawToken,
      url: `${webAppUrl.replace(/\/$/, "")}/access/${rawToken}`,
    };
  }

  private async deactivateActiveLinks(
    actorId: string,
    studentUserId: string,
  ): Promise<{ deactivated: number }> {
    const result = await this.prisma.accessLink.updateMany({
      where: { userId: studentUserId, deactivatedAt: null },
      data: { deactivatedAt: new Date() },
    });
    await this.auditLog.log(actorId, "user.deactivate_access_link", "User", studentUserId, {
      deactivated: result.count,
    });
    return { deactivated: result.count };
  }

  // Public (no auth guard - the whole point is the caller isn't signed in
  // yet). Reusable until deactivated - no time TTL, and redeem does not burn
  // the link. A deactivated (or unknown) token gets the same generic error.
  async redeem(rawToken: string): Promise<{ customToken: string }> {
    const link = await this.prisma.accessLink.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    const expired = link?.expiresAt != null && link.expiresAt.getTime() < Date.now();
    if (!link || link.deactivatedAt || expired) {
      throw new UnauthorizedException("This link is invalid or has expired.");
    }

    await this.prisma.accessLink.update({
      where: { id: link.id },
      data: { usedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: link.userId } });
    if (!user) {
      throw new UnauthorizedException("This link is invalid or has expired.");
    }

    // First redemption for a firebaseUid-null (Add Student) account mints
    // its Firebase identity right here, deterministically, so the
    // /auth/session exchange the client triggers right after this finds
    // this exact User row by firebaseUid - no reliance on the phone/email
    // claim heuristic AuthService.exchangeToken also has.
    let firebaseUid = user.firebaseUid;
    if (!firebaseUid) {
      firebaseUid = `student_${user.id}`;
      await this.prisma.user.update({ where: { id: user.id }, data: { firebaseUid } });
    }

    const customToken = await this.firebaseAdmin.createCustomToken(firebaseUid);
    return { customToken };
  }
}
