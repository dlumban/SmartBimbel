import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { DisputesService } from "./disputes.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MidtransService } from "../payments/midtrans.service";
import { AuditLogService } from "../audit-log/audit-log.service";

describe("DisputesService", () => {
  let prisma: {
    booking: { findUnique: jest.Mock };
    dispute: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    transaction: { update: jest.Mock };
  };
  let notifications: { send: jest.Mock };
  let midtrans: { refund: jest.Mock };
  let auditLog: { log: jest.Mock };
  let service: DisputesService;

  const student = { id: "student-user-1" } as User;
  const tutor = { id: "tutor-user-1" } as User;
  const admin = { id: "admin-1" } as User;
  const outsider = { id: "outsider-1" } as User;

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn() },
      dispute: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      transaction: { update: jest.fn() },
    };
    notifications = { send: jest.fn() };
    midtrans = { refund: jest.fn() };
    auditLog = { log: jest.fn().mockResolvedValue({}) };
    service = new DisputesService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      midtrans as unknown as MidtransService,
      auditLog as unknown as AuditLogService,
    );
  });

  describe("raise", () => {
    const booking = {
      id: "booking1",
      student: { userId: student.id },
      tutor: { userId: tutor.id },
      transaction: { id: "txn1" },
    };

    it("throws NotFoundException when the booking doesn't exist", async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.raise(student, "missing", { reason: "no show" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when the user is not a participant", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      await expect(service.raise(outsider, "booking1", { reason: "no show" })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("creates an OPEN dispute and notifies the other party (student raises -> tutor notified)", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.dispute.create.mockResolvedValue({ id: "dispute1" });

      await service.raise(student, "booking1", { reason: "Tutor never showed up" });

      expect(prisma.dispute.create).toHaveBeenCalledWith({
        data: {
          bookingId: "booking1",
          transactionId: "txn1",
          raisedByUserId: student.id,
          reason: "Tutor never showed up",
          status: "OPEN",
        },
      });
      expect(notifications.send).toHaveBeenCalledWith(tutor.id, "DISPUTE_RAISED", {
        disputeId: "dispute1",
        bookingId: "booking1",
      });
    });

    it("notifies the student when the tutor raises the dispute", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.dispute.create.mockResolvedValue({ id: "dispute1" });

      await service.raise(tutor, "booking1", { reason: "Student was abusive" });

      expect(notifications.send).toHaveBeenCalledWith(student.id, "DISPUTE_RAISED", {
        disputeId: "dispute1",
        bookingId: "booking1",
      });
    });
  });

  describe("resolve", () => {
    const disputeWith = (overrides: Partial<{ status: string; booking: unknown }>) => ({
      id: "dispute1",
      status: "OPEN",
      bookingId: "booking1",
      booking: {
        student: { userId: student.id },
        tutor: { userId: tutor.id },
        transaction: { id: "txn1", status: "PAID", gatewayRef: "gw-ref-1", amount: 100000 },
      },
      ...overrides,
    });

    it("throws NotFoundException when the dispute doesn't exist", async () => {
      prisma.dispute.findUnique.mockResolvedValue(null);
      await expect(
        service.resolve(admin, "missing", { status: "RESOLVED_NO_REFUND" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when already resolved", async () => {
      prisma.dispute.findUnique.mockResolvedValue(disputeWith({ status: "RESOLVED_REFUND" }));
      await expect(
        service.resolve(admin, "dispute1", { status: "RESOLVED_NO_REFUND" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("resolves RESOLVED_NO_REFUND without touching the transaction or calling midtrans", async () => {
      const dispute = disputeWith({});
      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.dispute.update.mockResolvedValue({ ...dispute, status: "RESOLVED_NO_REFUND" });

      await service.resolve(admin, "dispute1", {
        status: "RESOLVED_NO_REFUND",
        resolutionNotes: "No evidence of fault",
      });

      expect(midtrans.refund).not.toHaveBeenCalled();
      expect(prisma.transaction.update).not.toHaveBeenCalled();
      expect(notifications.send).toHaveBeenCalledWith(student.id, "DISPUTE_RESOLVED", {
        disputeId: "dispute1",
        bookingId: "booking1",
      });
      expect(notifications.send).toHaveBeenCalledWith(tutor.id, "DISPUTE_RESOLVED", {
        disputeId: "dispute1",
        bookingId: "booking1",
      });
    });

    it("throws BadRequestException for RESOLVED_REFUND when there is no PAID transaction", async () => {
      prisma.dispute.findUnique.mockResolvedValue(
        disputeWith({
          booking: {
            student: { userId: student.id },
            tutor: { userId: tutor.id },
            transaction: null,
          },
        }),
      );
      await expect(
        service.resolve(admin, "dispute1", { status: "RESOLVED_REFUND" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for RESOLVED_REFUND when the transaction has no gatewayRef", async () => {
      prisma.dispute.findUnique.mockResolvedValue(
        disputeWith({
          booking: {
            student: { userId: student.id },
            tutor: { userId: tutor.id },
            transaction: { id: "txn1", status: "PAID", gatewayRef: null, amount: 100000 },
          },
        }),
      );
      await expect(
        service.resolve(admin, "dispute1", { status: "RESOLVED_REFUND" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when refundAmount exceeds the paid amount", async () => {
      prisma.dispute.findUnique.mockResolvedValue(disputeWith({}));
      await expect(
        service.resolve(admin, "dispute1", { status: "RESOLVED_REFUND", refundAmount: 999999 }),
      ).rejects.toThrow(BadRequestException);
      expect(midtrans.refund).not.toHaveBeenCalled();
    });

    it("defaults refundAmount to the full transaction amount and calls midtrans.refund", async () => {
      const dispute = disputeWith({});
      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.dispute.update.mockResolvedValue({ ...dispute, status: "RESOLVED_REFUND" });

      await service.resolve(admin, "dispute1", {
        status: "RESOLVED_REFUND",
        resolutionNotes: "Confirmed no-show",
      });

      expect(midtrans.refund).toHaveBeenCalledWith("gw-ref-1", 100000, "Confirmed no-show");
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: "txn1" },
        data: { status: "REFUNDED", refundedAmount: 100000 },
      });
    });

    it("supports a partial refund amount", async () => {
      const dispute = disputeWith({});
      prisma.dispute.findUnique.mockResolvedValue(dispute);
      prisma.dispute.update.mockResolvedValue({ ...dispute, status: "RESOLVED_REFUND" });

      await service.resolve(admin, "dispute1", { status: "RESOLVED_REFUND", refundAmount: 40000 });

      expect(midtrans.refund).toHaveBeenCalledWith("gw-ref-1", 40000, undefined);
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: "txn1" },
        data: { status: "REFUNDED", refundedAmount: 40000 },
      });
    });
  });

  describe("listForBooking", () => {
    const booking = {
      id: "booking1",
      student: { userId: student.id },
      tutor: { userId: tutor.id },
    };

    it("throws NotFoundException when the booking doesn't exist", async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.listForBooking(student, "missing")).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException for a non-participant", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      await expect(service.listForBooking(outsider, "booking1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("returns disputes for a participant", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.dispute.findMany.mockResolvedValue([{ id: "dispute1" }]);

      const result = await service.listForBooking(student, "booking1");

      expect(result).toEqual([{ id: "dispute1" }]);
    });
  });
});
