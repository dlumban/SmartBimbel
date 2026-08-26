import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizePhoneToE164 } from "../common/phone.util";
import { UpsertStudentProfileDto } from "./dto/upsert-student-profile.dto";
import { ListStudentsDto } from "./dto/list-students.dto";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(user: User, dto: UpsertStudentProfileDto) {
    const existing = await this.prisma.studentProfile.findUnique({
      where: { userId: user.id },
    });
    if (existing) {
      throw new ConflictException(
        "Student profile already exists - use PATCH /students/me to edit it.",
      );
    }

    await this.assertReferencesExist(dto);

    return this.prisma.studentProfile.create({
      data: {
        userId: user.id,
        gradeLevelId: dto.gradeLevelId,
        preferredLocation: dto.preferredLocation,
        preferredMode: dto.preferredMode,
        subjectsOfInterest: { connect: dto.subjectIds.map((id) => ({ id })) },
      },
      include: { subjectsOfInterest: true, gradeLevel: true },
    });
  }

  async getMyProfile(user: User) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: { subjectsOfInterest: true, gradeLevel: true },
    });
    if (!profile) {
      throw new NotFoundException("No student profile exists for this account yet.");
    }
    return profile;
  }

  async updateProfile(user: User, dto: Partial<UpsertStudentProfileDto>) {
    const existing = await this.prisma.studentProfile.findUnique({
      where: { userId: user.id },
    });
    if (!existing) {
      throw new NotFoundException("No student profile exists for this account yet.");
    }

    await this.assertReferencesExist(dto);

    return this.prisma.studentProfile.update({
      where: { userId: user.id },
      data: {
        gradeLevelId: dto.gradeLevelId,
        preferredLocation: dto.preferredLocation,
        preferredMode: dto.preferredMode,
        ...(dto.subjectIds
          ? { subjectsOfInterest: { set: dto.subjectIds.map((id) => ({ id })) } }
          : {}),
      },
      include: { subjectsOfInterest: true, gradeLevel: true },
    });
  }

  // Paginated, name/phone/email-filterable listing of bookable students
  // (ACTIVE, with a completed profile) - lets a tutor browse and pick who to
  // schedule a session with (Task: tutor-initiated bookings). Mirrors
  // AdminUsersService.search()'s contains-based filter pattern, scoped to
  // role STUDENT and exposed to TUTOR callers only.
  //
  // Visibility: a student added by a tutor (addedByTutorId set) is private
  // to that tutor - excluded from every other tutor's view of this listing.
  // Admin-created/self-registered students (addedByTutorId null) stay
  // visible to every tutor, as before. `dto.mine` narrows to only the
  // requesting tutor's own added students (used by their private roster
  // page) instead of the global-pool + own-private union.
  async listForTutor(tutor: User, dto: ListStudentsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const visibility: Prisma.UserWhereInput = dto.mine
      ? { addedByTutorId: tutor.id }
      : { OR: [{ addedByTutorId: null }, { addedByTutorId: tutor.id }] };

    // Combined via AND (rather than spreading two `OR` keys onto the same
    // object) so the visibility clause and the search clause don't silently
    // clobber each other - both need to independently hold.
    const where: Prisma.UserWhereInput = {
      AND: [
        { role: "STUDENT", status: "ACTIVE", studentProfile: { isNot: null } },
        visibility,
        ...(dto.q
          ? [
              {
                OR: [
                  { name: { contains: dto.q, mode: "insensitive" as const } },
                  { phone: { contains: dto.q, mode: "insensitive" as const } },
                  { email: { contains: dto.q, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          studentProfile: { include: { gradeLevel: true, subjectsOfInterest: true } },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      // gradeLevel/subjectsOfInterest/preferredLocation/preferredMode are
      // included here (not just name/phone/email) so the tutor's own-roster
      // page ("mine: true") can prefill an edit form without a second
      // request - harmless extra fields for the mine:false booking-picker
      // callers, which only ever read name/phone/email/userId.
      data: users.map((u) => ({
        studentProfileId: u.studentProfile!.id,
        userId: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        gradeLevel: u.studentProfile!.gradeLevel,
        subjectsOfInterest: u.studentProfile!.subjectsOfInterest,
        preferredLocation: u.studentProfile!.preferredLocation,
        preferredMode: u.studentProfile!.preferredMode,
      })),
      total,
      page,
      limit,
    };
  }

  // Lets a tutor onboard a student directly (an offline referral/walk-in)
  // without them going through Firebase sign-up first - mirrors
  // AdminUsersService.createStudent() exactly, except the resulting User is
  // tagged with addedByTutorId so listForTutor()'s visibility rule keeps it
  // private to this tutor. Kept as its own method (rather than importing
  // AdminUsersService here) to keep StudentsModule and AdminUsersModule
  // decoupled, matching how the codebase already keeps them independent.
  async createForTutor(tutor: User, dto: CreateStudentDto) {
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

    await this.assertReferencesExist(dto);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: "STUDENT",
          name: dto.name,
          phone,
          email: dto.email ?? null,
          addedByTutorId: tutor.id,
        },
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
  }

  // Lets a tutor fix/update details for a student they added themselves -
  // same ownership rule as AccessLinksService.requireOwnedStudent()
  // (services/api/src/access-links/access-links.service.ts), reimplemented
  // locally rather than imported for the same module-decoupling reason as
  // createForTutor above.
  async updateForTutor(tutor: User, studentUserId: string, dto: UpdateStudentDto) {
    await this.requireOwnedStudent(tutor, studentUserId);

    const phone = dto.phone ? normalizePhoneToE164(dto.phone) : undefined;
    if (dto.phone && !phone) {
      throw new BadRequestException(`Invalid phone number: ${dto.phone}`);
    }

    if (phone || dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: {
          id: { not: studentUserId },
          OR: [...(phone ? [{ phone }] : []), ...(dto.email ? [{ email: dto.email }] : [])],
        },
      });
      if (conflict) {
        throw new ConflictException("A user with that phone or email already exists.");
      }
    }

    await this.assertReferencesExist(dto);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: studentUserId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
        },
      });
      await tx.studentProfile.update({
        where: { userId: studentUserId },
        data: {
          ...(dto.gradeLevelId !== undefined ? { gradeLevelId: dto.gradeLevelId } : {}),
          ...(dto.preferredLocation !== undefined
            ? { preferredLocation: dto.preferredLocation }
            : {}),
          ...(dto.preferredMode !== undefined ? { preferredMode: dto.preferredMode } : {}),
          ...(dto.subjectIds
            ? { subjectsOfInterest: { set: dto.subjectIds.map((id) => ({ id })) } }
            : {}),
        },
      });
      return user;
    });
  }

  private async requireOwnedStudent(tutor: User, studentUserId: string): Promise<User> {
    const student = await this.prisma.user.findUnique({ where: { id: studentUserId } });
    if (!student || student.role !== "STUDENT") {
      throw new NotFoundException("Student not found.");
    }
    if (student.addedByTutorId !== tutor.id) {
      throw new ForbiddenException("You can only edit students you added.");
    }
    return student;
  }

  private async assertReferencesExist(dto: Partial<UpsertStudentProfileDto>) {
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
}
