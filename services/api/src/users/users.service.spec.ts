import { ConflictException } from "@nestjs/common";
import { User } from "@prisma/client";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";

function makeUser(overrides: Partial<User>): User {
  return {
    id: "u1",
    role: null,
    phone: null,
    email: null,
    firebaseUid: "fb-1",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

describe("UsersService", () => {
  let prisma: {
    user: { update: jest.Mock };
    studentProfile: { findUnique: jest.Mock };
    tutorProfile: { findUnique: jest.Mock };
  };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: { update: jest.fn() },
      studentProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      tutorProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe("setRole", () => {
    it("sets the role for a user who hasn't chosen one yet", async () => {
      const user = makeUser({ role: null });
      prisma.user.update.mockResolvedValue({ ...user, role: "STUDENT" });

      const result = await service.setRole(user, "STUDENT");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { role: "STUDENT" },
      });
      expect(result.role).toBe("STUDENT");
    });

    it("rejects changing a role that's already set", async () => {
      const user = makeUser({ role: "TUTOR" });
      await expect(service.setRole(user, "STUDENT")).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("updateName", () => {
    it("updates the user's name", async () => {
      const user = makeUser({});
      prisma.user.update.mockResolvedValue({ ...user, name: "Andi" });

      const result = await service.updateName(user, "Andi");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { name: "Andi" },
      });
      expect(result.name).toBe("Andi");
    });
  });

  describe("toSummary", () => {
    it("reports hasProfile: false when neither profile exists", async () => {
      const summary = await service.toSummary(makeUser({}));
      expect(summary.hasProfile).toBe(false);
    });

    it("reports hasProfile: true when a student profile exists", async () => {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: "sp1" });
      const summary = await service.toSummary(makeUser({ role: "STUDENT" }));
      expect(summary.hasProfile).toBe(true);
    });

    it("reports hasProfile: false for a tutor profile that exists but hasn't been submitted", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue({
        id: "tp1",
        profileSubmittedAt: null,
      });
      const summary = await service.toSummary(makeUser({ role: "TUTOR" }));
      expect(summary.hasProfile).toBe(false);
    });

    it("reports hasProfile: true for a tutor profile once submitted", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue({
        id: "tp1",
        profileSubmittedAt: new Date(),
      });
      const summary = await service.toSummary(makeUser({ role: "TUTOR" }));
      expect(summary.hasProfile).toBe(true);
    });
  });
});
