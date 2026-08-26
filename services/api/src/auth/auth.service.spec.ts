import { Test, TestingModule } from "@nestjs/testing";
import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { FirebaseAdminService } from "./firebase-admin.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuthService", () => {
  let service: AuthService;
  let firebaseAdmin: { verifyIdToken: jest.Mock };
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    firebaseAdmin = { verifyIdToken: jest.fn() };
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: FirebaseAdminService, useValue: firebaseAdmin },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it("creates a new user on first login, normalizing the phone to E.164", async () => {
    firebaseAdmin.verifyIdToken.mockResolvedValue({
      uid: "fb-uid-1",
      phone_number: "+6281234500001",
      email: "andi@example.com",
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u1", role: null });

    const result = await service.exchangeToken("valid-token");

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        firebaseUid: "fb-uid-1",
        phone: "+6281234500001",
        email: "andi@example.com",
      },
    });
    expect(result).toEqual({ id: "u1", role: null });
  });

  it("returns the existing user on a repeat login without writing when nothing changed", async () => {
    const existing = {
      id: "u1",
      firebaseUid: "fb-uid-1",
      phone: "+6281234500001",
      email: "andi@example.com",
    };
    firebaseAdmin.verifyIdToken.mockResolvedValue({
      uid: "fb-uid-1",
      phone_number: "+6281234500001",
      email: "andi@example.com",
    });
    prisma.user.findUnique.mockResolvedValue(existing);

    const result = await service.exchangeToken("valid-token");

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it("syncs email when it changed on the Firebase side", async () => {
    const existing = {
      id: "u1",
      firebaseUid: "fb-uid-1",
      phone: "+6281234500001",
      email: "old@example.com",
    };
    firebaseAdmin.verifyIdToken.mockResolvedValue({
      uid: "fb-uid-1",
      phone_number: "+6281234500001",
      email: "new@example.com",
    });
    prisma.user.findUnique.mockResolvedValue(existing);
    prisma.user.update.mockResolvedValue({ ...existing, email: "new@example.com" });

    const result = await service.exchangeToken("valid-token");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { phone: "+6281234500001", email: "new@example.com" },
    });
    expect(result.email).toBe("new@example.com");
  });

  it("claims an admin-created (firebaseUid-null) user by phone on first login, instead of creating a duplicate", async () => {
    const preCreated = {
      id: "u1",
      firebaseUid: null,
      phone: "+6281234500001",
      email: null,
    };
    firebaseAdmin.verifyIdToken.mockResolvedValue({
      uid: "fb-uid-1",
      phone_number: "+6281234500001",
      email: undefined,
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(preCreated);
    prisma.user.update.mockResolvedValue({ ...preCreated, firebaseUid: "fb-uid-1" });

    const result = await service.exchangeToken("valid-token");

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { firebaseUid: null, OR: [{ phone: "+6281234500001" }] },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { firebaseUid: "fb-uid-1", phone: "+6281234500001", email: null },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(result.firebaseUid).toBe("fb-uid-1");
  });

  it("creates a new user when no claimable admin-created record matches", async () => {
    firebaseAdmin.verifyIdToken.mockResolvedValue({
      uid: "fb-uid-2",
      phone_number: "+6281234500002",
      email: "budi@example.com",
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "u2" });

    await service.exchangeToken("valid-token");

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { firebaseUid: "fb-uid-2", phone: "+6281234500002", email: "budi@example.com" },
    });
  });

  it("throws UnauthorizedException for an invalid/expired token", async () => {
    firebaseAdmin.verifyIdToken.mockRejectedValue(new Error("Firebase: token expired"));

    await expect(service.exchangeToken("bad-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("propagates a 503 when Firebase Admin isn't configured", async () => {
    firebaseAdmin.verifyIdToken.mockRejectedValue(
      new ServiceUnavailableException("Authentication is not configured on this server yet."),
    );

    await expect(service.exchangeToken("any-token")).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
