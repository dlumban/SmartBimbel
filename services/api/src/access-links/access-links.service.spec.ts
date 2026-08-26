import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { User } from "@prisma/client";
import { AccessLinksService } from "./access-links.service";
import { PrismaService } from "../prisma/prisma.service";
import { FirebaseAdminService } from "../auth/firebase-admin.service";
import { AuditLogService } from "../audit-log/audit-log.service";

describe("AccessLinksService", () => {
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    accessLink: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let firebaseAdmin: { createCustomToken: jest.Mock };
  let auditLog: { log: jest.Mock };
  let config: { get: jest.Mock };
  let service: AccessLinksService;

  const admin = { id: "admin-1" } as User;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      accessLink: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    firebaseAdmin = { createCustomToken: jest.fn().mockResolvedValue("custom-token-1") };
    auditLog = { log: jest.fn().mockResolvedValue({}) };
    config = { get: jest.fn().mockReturnValue(undefined) };
    service = new AccessLinksService(
      prisma as unknown as PrismaService,
      firebaseAdmin as unknown as FirebaseAdminService,
      auditLog as unknown as AuditLogService,
      config as unknown as ConfigService,
    );
  });

  describe("generate", () => {
    it("throws NotFoundException for an unknown user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.generate(admin, "missing")).rejects.toThrow(NotFoundException);
      expect(prisma.accessLink.create).not.toHaveBeenCalled();
    });

    it("throws BadRequestException for a non-STUDENT account", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "TUTOR" });
      await expect(service.generate(admin, "u1")).rejects.toThrow(BadRequestException);
      expect(prisma.accessLink.create).not.toHaveBeenCalled();
    });

    it("creates a non-expiring link, deactivates prior ones, and builds the URL from WEB_APP_URL", async () => {
      config.get.mockReturnValue("https://app.smartbimbel.id/");
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "STUDENT" });
      prisma.accessLink.create.mockResolvedValue({});

      const result = await service.generate(admin, "u1");

      expect(prisma.accessLink.updateMany).toHaveBeenCalledWith({
        where: { userId: "u1", deactivatedAt: null },
        data: { deactivatedAt: expect.any(Date) },
      });
      expect(prisma.accessLink.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.accessLink.create.mock.calls[0][0];
      expect(createArgs.data.userId).toBe("u1");
      expect(createArgs.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(createArgs.data.expiresAt).toBeUndefined();

      expect(result.token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
      expect(result.url).toBe(`https://app.smartbimbel.id/access/${result.token}`);
      expect(auditLog.log).toHaveBeenCalledWith(admin.id, "user.generate_access_link", "User", "u1", {});
    });

    it("falls back to localhost:3000 when WEB_APP_URL isn't configured", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "STUDENT" });
      prisma.accessLink.create.mockResolvedValue({});

      const result = await service.generate(admin, "u1");

      expect(result.url).toBe(`http://localhost:3000/access/${result.token}`);
    });
  });

  describe("generateForTutor", () => {
    const tutor = { id: "tutor-1" } as User;

    it("throws ForbiddenException for a student this tutor did not add", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "STUDENT", addedByTutorId: "other-tutor" });
      await expect(service.generateForTutor(tutor, "u1")).rejects.toThrow(ForbiddenException);
      expect(prisma.accessLink.create).not.toHaveBeenCalled();
    });

    it("issues a link for a student this tutor added", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "STUDENT", addedByTutorId: tutor.id });
      prisma.accessLink.create.mockResolvedValue({});

      await service.generateForTutor(tutor, "u1");

      expect(prisma.accessLink.create).toHaveBeenCalledTimes(1);
      expect(auditLog.log).toHaveBeenCalledWith(tutor.id, "user.generate_access_link", "User", "u1", {});
    });
  });

  describe("deactivateForTutor", () => {
    const tutor = { id: "tutor-1" } as User;

    it("deactivates active links for an owned student", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "STUDENT", addedByTutorId: tutor.id });
      prisma.accessLink.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.deactivateForTutor(tutor, "u1");

      expect(result).toEqual({ deactivated: 2 });
      expect(prisma.accessLink.updateMany).toHaveBeenCalledWith({
        where: { userId: "u1", deactivatedAt: null },
        data: { deactivatedAt: expect.any(Date) },
      });
      expect(auditLog.log).toHaveBeenCalledWith(tutor.id, "user.deactivate_access_link", "User", "u1", {
        deactivated: 2,
      });
    });

    it("throws ForbiddenException for a student this tutor did not add", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "STUDENT", addedByTutorId: "other" });
      await expect(service.deactivateForTutor(tutor, "u1")).rejects.toThrow(ForbiddenException);
    });
  });

  describe("redeem", () => {
    it("throws UnauthorizedException when no link matches the token", async () => {
      prisma.accessLink.findUnique.mockResolvedValue(null);
      await expect(service.redeem("bad-token")).rejects.toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException for a deactivated link", async () => {
      prisma.accessLink.findUnique.mockResolvedValue({
        id: "link-1",
        userId: "u1",
        usedAt: null,
        expiresAt: null,
        deactivatedAt: new Date(),
      });
      await expect(service.redeem("dead-token")).rejects.toThrow(UnauthorizedException);
      expect(prisma.accessLink.update).not.toHaveBeenCalled();
    });

    it("throws UnauthorizedException for a legacy expired link", async () => {
      prisma.accessLink.findUnique.mockResolvedValue({
        id: "link-1",
        userId: "u1",
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        deactivatedAt: null,
      });
      await expect(service.redeem("expired-token")).rejects.toThrow(UnauthorizedException);
      expect(prisma.accessLink.update).not.toHaveBeenCalled();
    });

    it("redeems a non-expiring active link without burning it, and records usedAt", async () => {
      prisma.accessLink.findUnique.mockResolvedValue({
        id: "link-1",
        userId: "u1",
        usedAt: new Date("2026-01-01"),
        expiresAt: null,
        deactivatedAt: null,
      });
      prisma.accessLink.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ id: "u1", firebaseUid: null });
      prisma.user.update.mockResolvedValue({});

      const result = await service.redeem("good-token");

      expect(prisma.accessLink.update).toHaveBeenCalledWith({
        where: { id: "link-1" },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { firebaseUid: "student_u1" },
      });
      expect(firebaseAdmin.createCustomToken).toHaveBeenCalledWith("student_u1");
      expect(result).toEqual({ customToken: "custom-token-1" });
    });

    it("reuses an existing firebaseUid without touching the user row", async () => {
      prisma.accessLink.findUnique.mockResolvedValue({
        id: "link-1",
        userId: "u1",
        usedAt: null,
        expiresAt: null,
        deactivatedAt: null,
      });
      prisma.accessLink.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ id: "u1", firebaseUid: "already-set-uid" });

      const result = await service.redeem("good-token");

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(firebaseAdmin.createCustomToken).toHaveBeenCalledWith("already-set-uid");
      expect(result).toEqual({ customToken: "custom-token-1" });
    });
  });
});
