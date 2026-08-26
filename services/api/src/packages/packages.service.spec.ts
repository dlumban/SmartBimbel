import { NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { PackagesService } from "./packages.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { RedisService } from "../redis/redis.service";

describe("PackagesService", () => {
  let prisma: {
    tutoringPackage: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditLog: { log: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let service: PackagesService;

  const admin = { id: "admin-1" } as User;

  const dto = {
    name: "Paket Hemat",
    sessionCount: 4,
    durationMinutes: 60 as const,
    totalPrice: 400000,
  };

  beforeEach(() => {
    prisma = {
      tutoringPackage: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    auditLog = { log: jest.fn().mockResolvedValue({}) };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    service = new PackagesService(
      prisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      redis as unknown as RedisService,
    );
  });

  describe("adminList", () => {
    it("returns every package, newest first", async () => {
      prisma.tutoringPackage.findMany.mockResolvedValue([{ id: "pkg1" }]);

      const result = await service.adminList();

      expect(prisma.tutoringPackage.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual([{ id: "pkg1" }]);
    });
  });

  describe("adminCreate", () => {
    it("creates the package, logs the action, and busts the active-packages cache", async () => {
      prisma.tutoringPackage.create.mockResolvedValue({ id: "pkg1", ...dto });

      const result = await service.adminCreate(admin, dto);

      expect(prisma.tutoringPackage.create).toHaveBeenCalledWith({ data: dto });
      expect(auditLog.log).toHaveBeenCalledWith(
        "admin-1",
        "package.create",
        "TutoringPackage",
        "pkg1",
        { ...dto },
      );
      expect(redis.del).toHaveBeenCalledWith("packages:active");
      expect(result).toEqual({ id: "pkg1", ...dto });
    });
  });

  describe("adminUpdate", () => {
    it("updates an existing package, logs the action, and busts the cache", async () => {
      prisma.tutoringPackage.findUnique.mockResolvedValue({ id: "pkg1" });
      prisma.tutoringPackage.update.mockResolvedValue({ id: "pkg1", name: "Paket Baru" });

      const result = await service.adminUpdate(admin, "pkg1", { name: "Paket Baru" });

      expect(prisma.tutoringPackage.update).toHaveBeenCalledWith({
        where: { id: "pkg1" },
        data: { name: "Paket Baru" },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        "admin-1",
        "package.update",
        "TutoringPackage",
        "pkg1",
        { name: "Paket Baru" },
      );
      expect(redis.del).toHaveBeenCalledWith("packages:active");
      expect(result).toEqual({ id: "pkg1", name: "Paket Baru" });
    });

    it("throws NotFoundException for an unknown package id", async () => {
      prisma.tutoringPackage.findUnique.mockResolvedValue(null);

      await expect(service.adminUpdate(admin, "nope", { name: "x" })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.tutoringPackage.update).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe("adminSetActive", () => {
    it("toggles isActive, logs the action, and busts the cache", async () => {
      prisma.tutoringPackage.findUnique.mockResolvedValue({ id: "pkg1", isActive: true });
      prisma.tutoringPackage.update.mockResolvedValue({ id: "pkg1", isActive: false });

      const result = await service.adminSetActive(admin, "pkg1", false);

      expect(prisma.tutoringPackage.update).toHaveBeenCalledWith({
        where: { id: "pkg1" },
        data: { isActive: false },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        "admin-1",
        "package.set_active",
        "TutoringPackage",
        "pkg1",
        { isActive: false },
      );
      expect(redis.del).toHaveBeenCalledWith("packages:active");
      expect(result).toEqual({ id: "pkg1", isActive: false });
    });

    it("throws NotFoundException for an unknown package id", async () => {
      prisma.tutoringPackage.findUnique.mockResolvedValue(null);

      await expect(service.adminSetActive(admin, "nope", true)).rejects.toThrow(NotFoundException);
      expect(prisma.tutoringPackage.update).not.toHaveBeenCalled();
    });
  });

  describe("listActive", () => {
    it("returns the cached value without hitting the database on a cache hit", async () => {
      redis.get.mockResolvedValue([{ id: "pkg1" }]);

      const result = await service.listActive();

      expect(result).toEqual([{ id: "pkg1" }]);
      expect(prisma.tutoringPackage.findMany).not.toHaveBeenCalled();
    });

    it("queries active packages and caches the result on a cache miss", async () => {
      redis.get.mockResolvedValue(null);
      prisma.tutoringPackage.findMany.mockResolvedValue([{ id: "pkg1", isActive: true }]);

      const result = await service.listActive();

      expect(prisma.tutoringPackage.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });
      expect(redis.set).toHaveBeenCalledWith(
        "packages:active",
        [{ id: "pkg1", isActive: true }],
        60 * 60,
      );
      expect(result).toEqual([{ id: "pkg1", isActive: true }]);
    });
  });
});
