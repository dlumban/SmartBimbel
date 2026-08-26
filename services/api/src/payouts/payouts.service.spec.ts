import { BadRequestException, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { MINIMUM_PAYOUT_AMOUNT_IDR, PayoutsService } from "./payouts.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EarningsService } from "../payments/earnings.service";
import { AuditLogService } from "../audit-log/audit-log.service";

describe("PayoutsService", () => {
  let prisma: {
    tutorProfile: { findUnique: jest.Mock; update: jest.Mock };
    payout: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };
  let earnings: { getBalanceSummary: jest.Mock };
  let notifications: { send: jest.Mock };
  let auditLog: { log: jest.Mock };
  let service: PayoutsService;

  const user = { id: "user-1" } as User;
  const admin = { id: "admin-1" } as User;

  beforeEach(() => {
    prisma = {
      tutorProfile: { findUnique: jest.fn(), update: jest.fn() },
      payout: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    earnings = { getBalanceSummary: jest.fn() };
    notifications = { send: jest.fn() };
    auditLog = { log: jest.fn().mockResolvedValue({}) };
    service = new PayoutsService(
      prisma as unknown as PrismaService,
      earnings as unknown as EarningsService,
      notifications as unknown as NotificationsService,
      auditLog as unknown as AuditLogService,
    );
  });

  describe("setBankDetails", () => {
    it("throws NotFoundException when the user has no tutor profile", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.setBankDetails(user, {
          bankName: "BCA",
          bankAccountNumber: "123",
          bankAccountHolderName: "Budi",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("updates the tutor profile's bank details", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue({ id: "tp1" });
      prisma.tutorProfile.update.mockResolvedValue({ id: "tp1", bankName: "BCA" });

      await service.setBankDetails(user, {
        bankName: "BCA",
        bankAccountNumber: "123",
        bankAccountHolderName: "Budi",
      });

      expect(prisma.tutorProfile.update).toHaveBeenCalledWith({
        where: { id: "tp1" },
        data: { bankName: "BCA", bankAccountNumber: "123", bankAccountHolderName: "Budi" },
      });
    });
  });

  describe("requestPayout", () => {
    const tutorProfile = {
      id: "tp1",
      bankName: "BCA",
      bankAccountNumber: "123",
      bankAccountHolderName: "Budi",
    };

    it("throws BadRequestException when bank details are not set", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue({ id: "tp1", bankName: null });
      await expect(service.requestPayout(user, { amount: 100000 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequestException when amount is below the minimum", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(tutorProfile);
      await expect(
        service.requestPayout(user, { amount: MINIMUM_PAYOUT_AMOUNT_IDR - 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when amount exceeds available balance", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(tutorProfile);
      earnings.getBalanceSummary.mockResolvedValue({ availableBalance: 50000 });
      await expect(service.requestPayout(user, { amount: 100000 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("creates a PENDING payout snapshotting bank details and notifies the tutor", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(tutorProfile);
      earnings.getBalanceSummary.mockResolvedValue({ availableBalance: 200000 });
      prisma.payout.create.mockResolvedValue({ id: "payout1" });

      const result = await service.requestPayout(user, { amount: 100000 });

      expect(prisma.payout.create).toHaveBeenCalledWith({
        data: {
          tutorId: "tp1",
          amount: 100000,
          status: "PENDING",
          bankName: "BCA",
          bankAccountNumber: "123",
          bankAccountHolderName: "Budi",
        },
      });
      expect(notifications.send).toHaveBeenCalledWith(user.id, "PAYOUT_REQUESTED", {
        payoutId: "payout1",
      });
      expect(result).toEqual({ id: "payout1" });
    });
  });

  describe("updateStatus", () => {
    const payout = (status: string) => ({
      id: "payout1",
      status,
      processedAt: null,
      failureReason: null,
      tutor: { user: { id: "tutor-user-1" } },
    });

    it("throws NotFoundException when the payout doesn't exist", async () => {
      prisma.payout.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus(admin, "missing", { status: "PROCESSING" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws BadRequestException on an invalid transition", async () => {
      prisma.payout.findUnique.mockResolvedValue(payout("COMPLETED"));
      await expect(service.updateStatus(admin, "payout1", { status: "PROCESSING" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequestException when marking FAILED without a failureReason", async () => {
      prisma.payout.findUnique.mockResolvedValue(payout("PENDING"));
      await expect(service.updateStatus(admin, "payout1", { status: "FAILED" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("allows PENDING -> PROCESSING and notifies the tutor", async () => {
      prisma.payout.findUnique.mockResolvedValue(payout("PENDING"));
      prisma.payout.update.mockResolvedValue({ id: "payout1", status: "PROCESSING" });

      await service.updateStatus(admin, "payout1", { status: "PROCESSING" });

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: "payout1" },
        data: {
          status: "PROCESSING",
          processedByUserId: admin.id,
          processedAt: null,
          failureReason: null,
        },
      });
      expect(notifications.send).toHaveBeenCalledWith("tutor-user-1", "PAYOUT_STATUS_CHANGED", {
        payoutId: "payout1",
        status: "PROCESSING",
      });
    });

    it("allows PROCESSING -> COMPLETED and stamps processedAt", async () => {
      prisma.payout.findUnique.mockResolvedValue(payout("PROCESSING"));
      prisma.payout.update.mockResolvedValue({ id: "payout1", status: "COMPLETED" });

      await service.updateStatus(admin, "payout1", { status: "COMPLETED" });

      const call = prisma.payout.update.mock.calls[0][0];
      expect(call.data.status).toBe("COMPLETED");
      expect(call.data.processedAt).toBeInstanceOf(Date);
    });

    it("allows PROCESSING -> FAILED with a failureReason", async () => {
      prisma.payout.findUnique.mockResolvedValue(payout("PROCESSING"));
      prisma.payout.update.mockResolvedValue({ id: "payout1", status: "FAILED" });

      await service.updateStatus(admin, "payout1", {
        status: "FAILED",
        failureReason: "Bank rejected transfer",
      });

      const call = prisma.payout.update.mock.calls[0][0];
      expect(call.data.status).toBe("FAILED");
      expect(call.data.failureReason).toBe("Bank rejected transfer");
    });
  });
});
