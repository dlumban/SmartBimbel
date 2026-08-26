import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { StudentsService } from "./students.service";
import { PrismaService } from "../prisma/prisma.service";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    role: "STUDENT",
    phone: null,
    email: null,
    firebaseUid: "fb-1",
    status: "ACTIVE",
    addedByTutorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function makeTutor(overrides: Partial<User> = {}): User {
  return makeUser({ id: "tutor-1", role: "TUTOR", ...overrides });
}

describe("StudentsService", () => {
  let prisma: {
    studentProfile: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    gradeLevel: { findUnique: jest.Mock };
    subject: { findMany: jest.Mock };
    user: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: StudentsService;

  beforeEach(() => {
    prisma = {
      studentProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      gradeLevel: { findUnique: jest.fn() },
      subject: { findMany: jest.fn() },
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new StudentsService(prisma as unknown as PrismaService);
  });

  describe("createProfile", () => {
    const dto = {
      gradeLevelId: "g1",
      subjectIds: ["s1", "s2"],
      preferredLocation: "Jakarta",
      preferredMode: "ONLINE" as const,
    };

    it("creates a profile when none exists and references are valid", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      prisma.gradeLevel.findUnique.mockResolvedValue({ id: "g1" });
      prisma.subject.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
      prisma.studentProfile.create.mockResolvedValue({ id: "sp1" });

      const result = await service.createProfile(makeUser(), dto);

      expect(prisma.studentProfile.create).toHaveBeenCalledWith({
        data: {
          userId: "u1",
          gradeLevelId: "g1",
          preferredLocation: "Jakarta",
          preferredMode: "ONLINE",
          subjectsOfInterest: { connect: [{ id: "s1" }, { id: "s2" }] },
        },
        include: { subjectsOfInterest: true, gradeLevel: true },
      });
      expect(result).toEqual({ id: "sp1" });
    });

    it("rejects when a profile already exists", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: "existing" });
      await expect(service.createProfile(makeUser(), dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("rejects an unknown gradeLevelId", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      prisma.gradeLevel.findUnique.mockResolvedValue(null);
      await expect(service.createProfile(makeUser(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects when a subjectId doesn't exist", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      prisma.gradeLevel.findUnique.mockResolvedValue({ id: "g1" });
      prisma.subject.findMany.mockResolvedValue([{ id: "s1" }]); // missing s2
      await expect(service.createProfile(makeUser(), dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("getMyProfile", () => {
    it("throws NotFoundException when no profile exists", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(service.getMyProfile(makeUser())).rejects.toThrow(NotFoundException);
    });

    it("returns the profile when it exists", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: "sp1" });
      const result = await service.getMyProfile(makeUser());
      expect(result).toEqual({ id: "sp1" });
    });
  });

  describe("updateProfile", () => {
    it("throws NotFoundException when no profile exists yet", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.updateProfile(makeUser(), { preferredLocation: "Bandung" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("updates only the provided fields", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: "sp1" });
      prisma.studentProfile.update.mockResolvedValue({ id: "sp1", preferredLocation: "Bandung" });

      await service.updateProfile(makeUser(), { preferredLocation: "Bandung" });

      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { userId: "u1" },
        data: {
          gradeLevelId: undefined,
          preferredLocation: "Bandung",
          preferredMode: undefined,
        },
        include: { subjectsOfInterest: true, gradeLevel: true },
      });
    });
  });

  describe("listForTutor", () => {
    const tutor = makeTutor();

    it("lists ACTIVE students with a profile, mapped to minimal fields, visible to any tutor by default", async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: "student-u1",
          name: "Andi Nugraha",
          phone: "+6281234567890",
          email: "andi@example.com",
          studentProfile: {
            id: "sp1",
            gradeLevel: { id: "g1", name: "SMA 1" },
            subjectsOfInterest: [{ id: "s1", name: "Matematika" }],
            preferredLocation: "Jakarta",
            preferredMode: "ONLINE",
          },
        },
      ]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.listForTutor(tutor, {});

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { role: "STUDENT", status: "ACTIVE", studentProfile: { isNot: null } },
            { OR: [{ addedByTutorId: null }, { addedByTutorId: tutor.id }] },
          ],
        },
        include: { studentProfile: { include: { gradeLevel: true, subjectsOfInterest: true } } },
        orderBy: { name: "asc" },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        data: [
          {
            studentProfileId: "sp1",
            userId: "student-u1",
            name: "Andi Nugraha",
            phone: "+6281234567890",
            email: "andi@example.com",
            gradeLevel: { id: "g1", name: "SMA 1" },
            subjectsOfInterest: [{ id: "s1", name: "Matematika" }],
            preferredLocation: "Jakarta",
            preferredMode: "ONLINE",
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it("filters by name/phone/email (contains, case-insensitive) when q is given", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.listForTutor(tutor, { q: "andi", page: 2, limit: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { role: "STUDENT", status: "ACTIVE", studentProfile: { isNot: null } },
            { OR: [{ addedByTutorId: null }, { addedByTutorId: tutor.id }] },
            {
              OR: [
                { name: { contains: "andi", mode: "insensitive" } },
                { phone: { contains: "andi", mode: "insensitive" } },
                { email: { contains: "andi", mode: "insensitive" } },
              ],
            },
          ],
        },
        include: { studentProfile: { include: { gradeLevel: true, subjectsOfInterest: true } } },
        orderBy: { name: "asc" },
        skip: 10,
        take: 10,
      });
    });

    it("returns an empty page when nothing matches", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      const result = await service.listForTutor(tutor, { q: "nobody" });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("scopes to only this tutor's own added students when mine=true", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.listForTutor(tutor, { mine: true });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { role: "STUDENT", status: "ACTIVE", studentProfile: { isNot: null } },
            { addedByTutorId: tutor.id },
          ],
        },
        include: { studentProfile: { include: { gradeLevel: true, subjectsOfInterest: true } } },
        orderBy: { name: "asc" },
        skip: 0,
        take: 20,
      });
    });
  });

  describe("createForTutor", () => {
    const tutor = makeTutor();
    const dto = {
      name: "Budi Santoso",
      phone: "081234567890",
      gradeLevelId: "g1",
      preferredLocation: "Jakarta",
      preferredMode: "ONLINE" as const,
    };

    it("creates a User + StudentProfile tagged with addedByTutorId", async () => {
      const created = { id: "student-new", role: "STUDENT" };
      prisma.gradeLevel.findUnique.mockResolvedValue({ id: "g1" });
      const tx = {
        user: { create: jest.fn().mockResolvedValue(created) },
        studentProfile: { create: jest.fn().mockResolvedValue({ id: "sp-new" }) },
      };
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockImplementation((fn) => fn(tx));

      const result = await service.createForTutor(tutor, dto);

      expect(tx.user.create).toHaveBeenCalledWith({
        data: {
          role: "STUDENT",
          name: "Budi Santoso",
          phone: "+6281234567890",
          email: null,
          addedByTutorId: tutor.id,
        },
      });
      expect(result).toEqual(created);
    });

    it("rejects when a user with that phone or email already exists", async () => {
      prisma.gradeLevel.findUnique.mockResolvedValue({ id: "g1" });
      prisma.user.findFirst.mockResolvedValue({ id: "existing" });

      await expect(service.createForTutor(tutor, dto)).rejects.toThrow(ConflictException);
    });

    it("rejects when neither phone nor email is provided", async () => {
      await expect(
        service.createForTutor(tutor, { ...dto, phone: undefined }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("updateForTutor", () => {
    const tutor = makeTutor();
    const owned = makeUser({
      id: "student-1",
      role: "STUDENT",
      addedByTutorId: tutor.id,
    });

    it("updates the User and StudentProfile rows with only the given fields", async () => {
      prisma.user.findUnique.mockResolvedValue(owned);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.gradeLevel.findUnique.mockResolvedValue({ id: "g2" });
      const tx = {
        user: { update: jest.fn().mockResolvedValue({ ...owned, name: "Budi Baru" }) },
        studentProfile: { update: jest.fn().mockResolvedValue({ id: "sp1" }) },
      };
      prisma.$transaction.mockImplementation((fn) => fn(tx));

      const result = await service.updateForTutor(tutor, "student-1", {
        name: "Budi Baru",
        gradeLevelId: "g2",
      });

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: "student-1" },
        data: { name: "Budi Baru" },
      });
      expect(tx.studentProfile.update).toHaveBeenCalledWith({
        where: { userId: "student-1" },
        data: { gradeLevelId: "g2" },
      });
      expect(result).toEqual({ ...owned, name: "Budi Baru" });
    });

    it("throws NotFoundException when the student doesn't exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateForTutor(tutor, "missing", { name: "X" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the target user isn't a STUDENT", async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ id: "t2", role: "TUTOR" }));
      await expect(
        service.updateForTutor(tutor, "t2", { name: "X" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when the student was added by a different tutor", async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ id: "student-2", role: "STUDENT", addedByTutorId: "other-tutor" }),
      );
      await expect(
        service.updateForTutor(tutor, "student-2", { name: "X" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects when the new phone/email collides with a different user", async () => {
      prisma.user.findUnique.mockResolvedValue(owned);
      prisma.user.findFirst.mockResolvedValue({ id: "someone-else" });

      await expect(
        service.updateForTutor(tutor, "student-1", { email: "taken@example.com" }),
      ).rejects.toThrow(ConflictException);
    });

    it("rejects an unknown gradeLevelId", async () => {
      prisma.user.findUnique.mockResolvedValue(owned);
      prisma.gradeLevel.findUnique.mockResolvedValue(null);

      await expect(
        service.updateForTutor(tutor, "student-1", { gradeLevelId: "nope" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an unknown subjectId", async () => {
      prisma.user.findUnique.mockResolvedValue(owned);
      prisma.subject.findMany.mockResolvedValue([]);

      await expect(
        service.updateForTutor(tutor, "student-1", { subjectIds: ["nope"] }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
