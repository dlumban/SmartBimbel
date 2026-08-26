import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { normalizePhoneToE164 } from "../common/phone.util";
import { SearchUsersDto } from "./dto/search-users.dto";
import { SetAdminRoleDto } from "./dto/set-admin-role.dto";
import { CreateStudentDto } from "../students/dto/create-student.dto";

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async search(query: SearchUsersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { email: { contains: query.q, mode: "insensitive" } },
          { phone: { contains: query.q, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true, tutorProfile: true },
    });
    if (!user) {
      throw new NotFoundException("No user with that id exists.");
    }

    const [bookingCount, transactionCount] = await Promise.all([
      this.prisma.booking.count({
        where: {
          OR: [
            { student: { userId: id } },
            { tutor: { userId: id } },
          ],
        },
      }),
      this.prisma.transaction.count({
        where: {
          OR: [
            { booking: { student: { userId: id } } },
            { booking: { tutor: { userId: id } } },
          ],
        },
      }),
    ]);

    return { ...user, bookingCount, transactionCount };
  }

  // Blocks login/API access immediately (FirebaseAuthGuard already rejects
  // every request from a SUSPENDED user, Sprint 1) - this is the only place
  // that flips the switch.
  async suspend(admin: User, id: string, reason: string) {
    const target = await this.requireUser(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: "SUSPENDED" },
    });
    await this.auditLog.log(admin.id, "user.suspend", "User", id, { reason, targetEmail: target.email });
    return updated;
  }

  async reinstate(admin: User, id: string) {
    await this.requireUser(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
    await this.auditLog.log(admin.id, "user.reinstate", "User", id);
    return updated;
  }

  // Role management (Task 7.1's own scope: "including... role management")
  // is Super-Admin-only, enforced at the controller via @AdminRoles - this
  // only ever changes the sub-role of an existing ADMIN account, never
  // promotes a Student/Tutor to ADMIN (that bootstrap step stays a direct
  // DB action, per the precedent Sprint 1 already documented).
  async setAdminRole(admin: User, id: string, dto: SetAdminRoleDto) {
    const target = await this.requireUser(id);
    if (target.role !== "ADMIN") {
      throw new BadRequestException("Only an existing ADMIN account can have an admin sub-role set.");
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { adminRole: dto.adminRole },
    });
    await this.auditLog.log(admin.id, "user.set_admin_role", "User", id, {
      adminRole: dto.adminRole,
    });
    return updated;
  }

  // Lets an admin onboard a student who was referred offline (e.g. a walk-in
  // or phone booking) without them going through Firebase sign-up first.
  // The resulting User has no firebaseUid - AuthService.exchangeToken claims
  // it by phone/email the first time this person actually logs in, so
  // there's no duplicate-account risk if they eventually do.
  async createStudent(admin: User, dto: CreateStudentDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException("At least one of phone or email is required.");
    }

    const phone = dto.phone ? normalizePhoneToE164(dto.phone) : null;
    if (dto.phone && !phone) {
      throw new BadRequestException(`Invalid phone number: ${dto.phone}`);
    }

    const conflict = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });
    if (conflict) {
      throw new ConflictException("A user with that phone or email already exists.");
    }

    await this.assertStudentRefsExist(dto);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { role: "STUDENT", name: dto.name, phone, email: dto.email ?? null },
      });
      await tx.studentProfile.create({
        data: {
          userId: user.id,
          gradeLevelId: dto.gradeLevelId,
          preferredLocation: dto.preferredLocation,
          preferredMode: dto.preferredMode,
          ...(dto.subjectIds
            ? { subjectsOfInterest: { connect: dto.subjectIds.map((id) => ({ id })) } }
            : {}),
        },
      });
      return user;
    });

    await this.auditLog.log(admin.id, "user.create_student", "User", created.id, {
      name: dto.name,
      phone,
      email: dto.email ?? null,
    });

    return created;
  }

  private async assertStudentRefsExist(dto: CreateStudentDto) {
    if (dto.gradeLevelId) {
      const gradeLevel = await this.prisma.gradeLevel.findUnique({
        where: { id: dto.gradeLevelId },
      });
      if (!gradeLevel) {
        throw new BadRequestException(`Unknown gradeLevelId: ${dto.gradeLevelId}`);
      }
    }

    if (dto.subjectIds) {
      const subjects = await this.prisma.subject.findMany({
        where: { id: { in: dto.subjectIds } },
      });
      if (subjects.length !== dto.subjectIds.length) {
        throw new BadRequestException("One or more subjectIds are unknown.");
      }
    }
  }

  // Hard delete (Task: "Delete" alongside Suspend, admin panel) - the
  // schema's FKs cascade this into every table the user genuinely owns
  // (profile, bookings made on it, transactions, messages, notifications,
  // reviews, ...); "who performed this" actor fields elsewhere (e.g. who
  // cancelled someone else's booking) are SET NULL rather than cascaded, so
  // deleting one account never destroys another party's records. AuditLog
  // rows survive too (adminUserId SET NULL) per that model's own
  // append-only invariant. This is irreversible - unlike suspend/reinstate,
  // there is no undo.
  async remove(admin: User, id: string) {
    if (admin.id === id) {
      throw new BadRequestException("You cannot delete your own account.");
    }
    const target = await this.requireUser(id);
    if (target.role === "ADMIN" && admin.adminRole !== "SUPER_ADMIN") {
      throw new BadRequestException("Only a Super Admin can delete an ADMIN account.");
    }

    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        throw new ConflictException(
          "This account still has related records that prevent deletion. Suspend it instead.",
        );
      }
      throw e;
    }
    await this.auditLog.log(admin.id, "user.delete", "User", id, {
      name: target.name,
      email: target.email,
      phone: target.phone,
      role: target.role,
    });
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException("No user with that id exists.");
    }
    return user;
  }
}
