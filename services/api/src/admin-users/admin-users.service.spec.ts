import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { AdminUsersService } from "./admin-users.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";

describe("AdminUsersService", () => {
  let prisma: {
    user: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    booking: { count: jest.Mock };
    transaction: { count: jest.Mock };
    gradeLevel: { findUnique: jest.Mock };
    subject: { findMany: jest.Mock };
    studentProfile: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };
  let service: AdminUsersService;

  const admin = { id: "admin-1" } as User;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      booking: { count: jest.fn() },
      transaction: { count: jest.fn() },
      gradeLevel: { findUnique: jest.fn() },
      subject: { findMany: jest.fn() },
      studentProfile: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    // Runs the callback against `prisma` itself, matching every test's
    // tx.user.create / tx.studentProfile.create expectations below.
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
    auditLog = { log: jest.fn().mockResolvedValue({}) };
    service = new AdminUsersService(prisma as unknown as PrismaService, auditLog as unknown as AuditLogService);
  });

  describe("search", () => {
    it("filters by role/status/q and paginates", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "u1" }]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.search({ role: "TUTOR", status: "ACTIVE", q: "budi" });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: "TUTOR",
            status: "ACTIVE",
            OR: [
              { name: { contains: "budi", mode: "insensitive" } },
              { email: { contains: "budi", mode: "insensitive" } },
              { phone: { contains: "budi", mode: "insensitive" } },
            ],
          },
        }),
      );
      expect(result.total).toBe(1);
    });
  });

  describe("detail", () => {
    it("throws NotFoundException for an unknown user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.detail("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the user with booking/transaction counts", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", name: "Budi" });
      prisma.booking.count.mockResolvedValue(5);
      prisma.transaction.count.mockResolvedValue(3);

      const result = await service.detail("u1");

      expect(result).toEqual({ id: "u1", name: "Budi", bookingCount: 5, transactionCount: 3 });
    });
  });

  describe("suspend / reinstate", () => {
    it("suspends a user and audit-logs the reason", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", email: "u1@example.com" });
      prisma.user.update.mockResolvedValue({ id: "u1", status: "SUSPENDED" });

      const result = await service.suspend(admin, "u1", "Melanggar kebijakan");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { status: "SUSPENDED" },
      });
      expect(auditLog.log).toHaveBeenCalledWith(admin.id, "user.suspend", "User", "u1", {
        reason: "Melanggar kebijakan",
        targetEmail: "u1@example.com",
      });
      expect(result.status).toBe("SUSPENDED");
    });

    it("throws NotFoundException suspending an unknown user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.suspend(admin, "missing", "reason")).rejects.toThrow(NotFoundException);
    });

    it("reinstates a suspended user and audit-logs it", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1" });
      prisma.user.update.mockResolvedValue({ id: "u1", status: "ACTIVE" });

      await service.reinstate(admin, "u1");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { status: "ACTIVE" },
      });
      expect(auditLog.log).toHaveBeenCalledWith(admin.id, "user.reinstate", "User", "u1");
    });
  });

  describe("setAdminRole", () => {
    it("throws BadRequestException when the target isn't an ADMIN account", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "TUTOR" });
      await expect(
        service.setAdminRole(admin, "u1", { adminRole: "SUPPORT" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("sets the admin sub-role and audit-logs it", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "ADMIN" });
      prisma.user.update.mockResolvedValue({ id: "u1", role: "ADMIN", adminRole: "SUPPORT" });

      await service.setAdminRole(admin, "u1", { adminRole: "SUPPORT" });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { adminRole: "SUPPORT" },
      });
      expect(auditLog.log).toHaveBeenCalledWith(admin.id, "user.set_admin_role", "User", "u1", {
        adminRole: "SUPPORT",
      });
    });
  });

  describe("createStudent", () => {
    const dto = {
      name: "Siti Aminah",
      phone: "081234500009",
      email: undefined,
      gradeLevelId: undefined,
      subjectIds: undefined,
      preferredLocation: undefined,
      preferredMode: undefined,
    };

    it("throws BadRequestException when neither phone nor email is given", async () => {
      await expect(
        service.createStudent(admin, { ...dto, phone: undefined }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("throws BadRequestException for an unparseable phone number", async () => {
      await expect(
        service.createStudent(admin, { ...dto, phone: "not-a-phone" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws ConflictException when the phone/email is already in use", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "existing" });
      await expect(service.createStudent(admin, dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("throws BadRequestException for an unknown gradeLevelId", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.gradeLevel.findUnique.mockResolvedValue(null);
      await expect(
        service.createStudent(admin, { ...dto, gradeLevelId: "missing" }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when a subjectId is unknown", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.subject.findMany.mockResolvedValue([{ id: "s1" }]);
      await expect(
        service.createStudent(admin, { ...dto, subjectIds: ["s1", "s2"] }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates the User + StudentProfile, normalizes the phone, and audit-logs it", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.gradeLevel.findUnique.mockResolvedValue({ id: "g1" });
      prisma.subject.findMany.mockResolvedValue([{ id: "s1" }]);
      prisma.user.create.mockResolvedValue({ id: "u9", role: "STUDENT", name: "Siti Aminah" });
      prisma.studentProfile.create.mockResolvedValue({ id: "sp1" });

      const result = await service.createStudent(admin, {
        ...dto,
        gradeLevelId: "g1",
        subjectIds: ["s1"],
        preferredMode: "ONLINE",
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { role: "STUDENT", name: "Siti Aminah", phone: "+6281234500009", email: null },
      });
      expect(prisma.studentProfile.create).toHaveBeenCalledWith({
        data: {
          userId: "u9",
          gradeLevelId: "g1",
          preferredLocation: undefined,
          preferredMode: "ONLINE",
          subjectsOfInterest: { connect: [{ id: "s1" }] },
        },
      });
      expect(auditLog.log).toHaveBeenCalledWith(admin.id, "user.create_student", "User", "u9", {
        name: "Siti Aminah",
        phone: "+6281234500009",
        email: null,
      });
      expect(result).toEqual({ id: "u9", role: "STUDENT", name: "Siti Aminah" });
    });
  });

  describe("remove", () => {
    it("throws BadRequestException when an admin tries to delete themselves", async () => {
      await expect(service.remove(admin, admin.id)).rejects.toThrow(BadRequestException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for an unknown user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.remove(admin, "missing")).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException deleting an ADMIN account as a non-Super-Admin", async () => {
      const supportAdmin = { id: "admin-2", adminRole: "SUPPORT" } as User;
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "ADMIN" });

      await expect(service.remove(supportAdmin, "u1")).rejects.toThrow(BadRequestException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("lets a Super Admin delete an ADMIN account", async () => {
      const superAdmin = { id: "admin-2", adminRole: "SUPER_ADMIN" } as User;
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "ADMIN" });
      prisma.user.delete.mockResolvedValue({ id: "u1" });

      await service.remove(superAdmin, "u1");

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    });

    it("maps a foreign-key violation to ConflictException", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "TUTOR" });
      const fkError = new Prisma.PrismaClientKnownRequestError("FK", {
        code: "P2003",
        clientVersion: "test",
      });
      prisma.user.delete.mockRejectedValue(fkError);

      await expect(service.remove(admin, "u1")).rejects.toThrow(ConflictException);
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it("deletes a Student/Tutor and audit-logs a snapshot of what was deleted", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        role: "STUDENT",
        name: "Budi",
        email: "budi@example.com",
        phone: "+62812345",
      });
      prisma.user.delete.mockResolvedValue({ id: "u1" });

      await service.remove(admin, "u1");

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
      expect(auditLog.log).toHaveBeenCalledWith(admin.id, "user.delete", "User", "u1", {
        name: "Budi",
        email: "budi@example.com",
        phone: "+62812345",
        role: "STUDENT",
      });
    });
  });
});
