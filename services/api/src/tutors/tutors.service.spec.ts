import { BadRequestException, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { TutorsService } from "./tutors.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { RedisService } from "../redis/redis.service";
import { AuditLogService } from "../audit-log/audit-log.service";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    role: "TUTOR",
    phone: null,
    email: null,
    firebaseUid: "fb-1",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "tp1",
    userId: "u1",
    bio: "Experienced tutor",
    education: "S1 Fisika",
    hourlyRate: 150000,
    teachingModes: ["ONLINE"],
    city: "Jakarta",
    ktpDocumentPath: "tutor-documents/u1/ktp.jpg",
    diplomaDocumentPath: null,
    profileSubmittedAt: null,
    subjects: [{ id: "s1" }],
    gradeLevels: [{ id: "g1" }],
    ...overrides,
  };
}

describe("TutorsService", () => {
  let prisma: {
    tutorProfile: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    subject: { findMany: jest.Mock };
    gradeLevel: { findMany: jest.Mock };
  };
  let storage: { save: jest.Mock; read: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock };
  let auditLog: { log: jest.Mock };
  let service: TutorsService;
  const admin = makeUser({ id: "admin-1", role: "ADMIN" });

  beforeEach(() => {
    prisma = {
      tutorProfile: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      subject: { findMany: jest.fn() },
      gradeLevel: { findMany: jest.fn() },
    };
    storage = { save: jest.fn(), read: jest.fn() };
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    auditLog = { log: jest.fn().mockResolvedValue({}) };
    service = new TutorsService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      redis as unknown as RedisService,
      auditLog as unknown as AuditLogService,
    );
  });

  describe("upsertProfile", () => {
    it("creates a new profile when none exists", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(null);
      prisma.subject.findMany.mockResolvedValue([{ id: "s1" }]);
      prisma.tutorProfile.create.mockResolvedValue(baseProfile());

      await service.upsertProfile(makeUser(), { bio: "hi", subjectIds: ["s1"] });

      expect(prisma.tutorProfile.create).toHaveBeenCalled();
    });

    it("updates an existing profile instead of creating a duplicate", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(baseProfile());
      prisma.tutorProfile.update.mockResolvedValue(baseProfile({ city: "Bandung" }));

      const result = await service.upsertProfile(makeUser(), { city: "Bandung" });

      expect(prisma.tutorProfile.create).not.toHaveBeenCalled();
      expect(prisma.tutorProfile.update).toHaveBeenCalled();
      expect(result.city).toBe("Bandung");
    });

    it("rejects an unknown subjectId", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(null);
      prisma.subject.findMany.mockResolvedValue([]); // none found
      await expect(
        service.upsertProfile(makeUser(), { subjectIds: ["nonexistent"] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("submitForReview", () => {
    it("rejects submission when required fields are missing", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(
        baseProfile({ ktpDocumentPath: null }),
      );
      await expect(service.submitForReview(makeUser())).rejects.toThrow(
        BadRequestException,
      );
    });

    it("succeeds and sets profileSubmittedAt when the profile is complete", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(baseProfile());
      prisma.tutorProfile.update.mockResolvedValue(
        baseProfile({ profileSubmittedAt: new Date() }),
      );

      const result = await service.submitForReview(makeUser());

      expect(prisma.tutorProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "tp1" },
          data: expect.objectContaining({ profileSubmittedAt: expect.any(Date) }),
        }),
      );
      expect(result.profileSubmittedAt).not.toBeNull();
    });

    it("throws NotFoundException when no profile exists yet", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(null);
      await expect(service.submitForReview(makeUser())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("uploadDocument / getDocument", () => {
    it("saves the file via StorageService and records the path", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(baseProfile());
      storage.save.mockResolvedValue("tutor-documents/u1/ktp.jpg");
      prisma.tutorProfile.update.mockResolvedValue(baseProfile());

      const file = {
        originalname: "ktp.jpg",
        buffer: Buffer.from("fake"),
      } as Express.Multer.File;

      await service.uploadDocument(makeUser(), "ktp", file);

      expect(storage.save).toHaveBeenCalledWith("tutor-documents/u1", "ktp.jpg", file.buffer);
      expect(prisma.tutorProfile.update).toHaveBeenCalledWith({
        where: { id: "tp1" },
        data: { ktpDocumentPath: "tutor-documents/u1/ktp.jpg" },
      });
    });

    it("throws NotFoundException reading a document that was never uploaded", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(
        baseProfile({ diplomaDocumentPath: null }),
      );
      await expect(service.getDocument(makeUser(), "diploma")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getDocumentForReview", () => {
    it("reads a document by tutorProfileId for admin review", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(baseProfile());
      storage.read.mockResolvedValue(Buffer.from("fake ktp"));

      const buffer = await service.getDocumentForReview("tp1", "ktp");

      expect(storage.read).toHaveBeenCalledWith(baseProfile().ktpDocumentPath);
      expect(buffer.toString()).toBe("fake ktp");
    });

    it("throws NotFoundException for an unknown tutor profile", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(null);
      await expect(service.getDocumentForReview("missing", "ktp")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NotFoundException when the document was never uploaded", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(baseProfile({ diplomaDocumentPath: null }));
      await expect(service.getDocumentForReview("tp1", "diploma")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("listPendingReview", () => {
    it("queries for submitted, still-pending profiles ordered oldest first", async () => {
      prisma.tutorProfile.findMany.mockResolvedValue([baseProfile()]);
      await service.listPendingReview();
      expect(prisma.tutorProfile.findMany).toHaveBeenCalledWith({
        where: { profileSubmittedAt: { not: null }, verificationStatus: "PENDING" },
        include: { subjects: true, gradeLevels: true, user: true },
        orderBy: { profileSubmittedAt: "asc" },
      });
    });
  });

  describe("verify", () => {
    it("throws NotFoundException for an unknown profile id", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.verify(admin, "nonexistent", { status: "VERIFIED" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects verifying a profile that was never submitted", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(
        baseProfile({ profileSubmittedAt: null }),
      );
      await expect(
        service.verify(admin, "tp1", { status: "VERIFIED" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("approves a submitted profile and audit-logs the action", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(
        baseProfile({ profileSubmittedAt: new Date() }),
      );
      prisma.tutorProfile.update.mockResolvedValue(
        baseProfile({ verificationStatus: "VERIFIED" }),
      );

      await service.verify(admin, "tp1", { status: "VERIFIED" });

      expect(prisma.tutorProfile.update).toHaveBeenCalledWith({
        where: { id: "tp1" },
        data: { verificationStatus: "VERIFIED", rejectionReason: null },
        include: { subjects: true, gradeLevels: true },
      });
      expect(auditLog.log).toHaveBeenCalledWith(admin.id, "tutor.verify", "TutorProfile", "tp1", {
        status: "VERIFIED",
        reason: undefined,
      });
    });

    it("rejects a submitted profile with a reason", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(
        baseProfile({ profileSubmittedAt: new Date() }),
      );
      prisma.tutorProfile.update.mockResolvedValue(
        baseProfile({ verificationStatus: "REJECTED", rejectionReason: "Dokumen tidak jelas" }),
      );

      await service.verify(admin, "tp1", { status: "REJECTED", reason: "Dokumen tidak jelas" });

      expect(prisma.tutorProfile.update).toHaveBeenCalledWith({
        where: { id: "tp1" },
        data: { verificationStatus: "REJECTED", rejectionReason: "Dokumen tidak jelas" },
        include: { subjects: true, gradeLevels: true },
      });
    });
  });

  describe("search caching", () => {
    it("caches the default (unfiltered, page 1) query", async () => {
      prisma.tutorProfile.count.mockResolvedValue(0);
      prisma.tutorProfile.findMany.mockResolvedValue([]);

      await service.search({});

      expect(redis.get).toHaveBeenCalledWith("tutors:default-query:page1");
      expect(redis.set).toHaveBeenCalledWith(
        "tutors:default-query:page1",
        expect.any(Object),
        expect.any(Number),
      );
    });

    it("returns the cached value without querying Postgres on a cache hit", async () => {
      const cached = { data: [], page: 1, limit: 20, total: 0 };
      redis.get.mockResolvedValue(cached);

      const result = await service.search({});

      expect(prisma.tutorProfile.findMany).not.toHaveBeenCalled();
      expect(result).toBe(cached);
    });

    it("does not use the cache for a filtered query", async () => {
      prisma.tutorProfile.count.mockResolvedValue(0);
      prisma.tutorProfile.findMany.mockResolvedValue([]);

      await service.search({ city: "Bandung" });

      expect(redis.get).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });
  });
});
