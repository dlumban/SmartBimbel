import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { User } from "@prisma/client";
import { Queue } from "bullmq";
import { PaymentsService, PAYMENT_WINDOW_HOURS } from "./payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { MidtransService } from "./midtrans.service";
import { NotificationsService } from "../notifications/notifications.service";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    role: "STUDENT",
    phone: null,
    email: null,
    name: null,
    firebaseUid: "fb-1",
    status: "ACTIVE",
    whatsappOptOut: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function makeConfig(values: Record<string, string | undefined> = {}) {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe("PaymentsService", () => {
  let prisma: {
    booking: { findUnique: jest.Mock; update: jest.Mock };
    transaction: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    bookingStatusHistory: { create: jest.Mock };
    studentProfile: { findUnique: jest.Mock };
    tutorProfile: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let midtrans: {
    createSnapTransaction: jest.Mock;
    verifySignature: jest.Mock;
  };
  let notifications: { send: jest.Mock };
  let queue: { add: jest.Mock };
  let autoCompleteQueue: { add: jest.Mock };
  let service: PaymentsService;

  const studentUser = makeUser({ id: "student-user-1", role: "STUDENT" });

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn(), update: jest.fn() },
      transaction: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      bookingStatusHistory: { create: jest.fn() },
      studentProfile: { findUnique: jest.fn() },
      tutorProfile: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    midtrans = {
      createSnapTransaction: jest.fn(),
      verifySignature: jest.fn(),
    };
    notifications = { send: jest.fn().mockResolvedValue({}) };
    queue = { add: jest.fn() };
    autoCompleteQueue = { add: jest.fn() };
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      makeConfig(),
      midtrans as unknown as MidtransService,
      notifications as unknown as NotificationsService,
      queue as unknown as Queue,
      autoCompleteQueue as unknown as Queue,
    );
  });

  describe("schedulePaymentExpiry", () => {
    it("enqueues a job with the documented payment window delay", async () => {
      await service.schedulePaymentExpiry("b1");
      expect(queue.add).toHaveBeenCalledWith(
        "expire-unpaid-booking",
        { bookingId: "b1" },
        { delay: PAYMENT_WINDOW_HOURS * 60 * 60 * 1000 },
      );
    });
  });

  describe("initiatePayment", () => {
    function makeBooking(overrides: Record<string, unknown> = {}) {
      return {
        id: "b1",
        status: "ACCEPTED",
        priceAmount: 100000,
        student: { userId: "student-user-1" },
        transaction: null,
        ...overrides,
      };
    }

    it("creates a new PENDING transaction and returns a Snap token", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.transaction.create.mockResolvedValue({ id: "tx1", amount: 100000, commission: 15000 });
      midtrans.createSnapTransaction.mockResolvedValue({
        token: "snap-token",
        redirectUrl: "https://snap.example/pay",
      });

      const result = await service.initiatePayment(studentUser, "b1");

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: { bookingId: "b1", amount: 100000, commission: 15000, status: "PENDING" },
      });
      expect(midtrans.createSnapTransaction).toHaveBeenCalledWith("tx1", 100000);
      expect(result).toEqual({
        token: "snap-token",
        redirectUrl: "https://snap.example/pay",
        transactionId: "tx1",
      });
    });

    it("reuses an existing non-paid transaction rather than creating a duplicate", async () => {
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({ transaction: { id: "tx1", amount: 100000, status: "FAILED" } }),
      );
      midtrans.createSnapTransaction.mockResolvedValue({
        token: "snap-token-2",
        redirectUrl: "https://snap.example/pay2",
      });

      await service.initiatePayment(studentUser, "b1");

      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(midtrans.createSnapTransaction).toHaveBeenCalledWith("tx1", 100000);
    });

    it("rejects a booking that isn't ACCEPTED", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "REQUESTED" }));
      await expect(service.initiatePayment(studentUser, "b1")).rejects.toThrow(BadRequestException);
    });

    it("rejects a booking that's already been paid for", async () => {
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({ transaction: { id: "tx1", status: "PAID" } }),
      );
      await expect(service.initiatePayment(studentUser, "b1")).rejects.toThrow(BadRequestException);
    });

    it("rejects a non-student participant", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      const tutorUser = makeUser({ id: "tutor-user-1", role: "TUTOR" });
      await expect(service.initiatePayment(tutorUser, "b1")).rejects.toThrow(ForbiddenException);
    });

    it("throws NotFoundException for a nonexistent booking", async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.initiatePayment(studentUser, "b1")).rejects.toThrow(NotFoundException);
    });

    it("rejects a booking with no price set", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ priceAmount: null }));
      await expect(service.initiatePayment(studentUser, "b1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("handleWebhook", () => {
    const basePayload = {
      order_id: "tx1",
      status_code: "200",
      gross_amount: "100000.00",
      signature_key: "valid-signature",
      transaction_status: "settlement",
      transaction_id: "midtrans-tx-1",
    };

    function makeTransaction(overrides: Record<string, unknown> = {}) {
      return {
        id: "tx1",
        bookingId: "b1",
        status: "PENDING",
        booking: {
          id: "b1",
          scheduledAt: new Date("2026-09-01T09:00:00.000Z"),
          durationMinutes: 60,
          student: { userId: "student-user-1" },
          tutor: { userId: "tutor-user-1" },
        },
        ...overrides,
      };
    }

    it("rejects a tampered/invalid signature before touching the DB", async () => {
      midtrans.verifySignature.mockReturnValue(false);
      await expect(service.handleWebhook(basePayload)).rejects.toThrow(UnauthorizedException);
      expect(prisma.transaction.findUnique).not.toHaveBeenCalled();
    });

    it("marks the transaction PAID and confirms the booking on settlement", async () => {
      midtrans.verifySignature.mockReturnValue(true);
      prisma.transaction.findUnique.mockResolvedValue(makeTransaction());

      await service.handleWebhook(basePayload);

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: "tx1" },
        data: { status: "PAID", gatewayRef: "midtrans-tx-1", paidAt: expect.any(Date) },
      });
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: { status: "CONFIRMED" },
      });
      expect(notifications.send).toHaveBeenCalledWith("student-user-1", "BOOKING_CONFIRMED", {
        bookingId: "b1",
      });
      expect(notifications.send).toHaveBeenCalledWith("tutor-user-1", "BOOKING_CONFIRMED", {
        bookingId: "b1",
      });
      expect(autoCompleteQueue.add).toHaveBeenCalledWith(
        "auto-complete-session",
        { bookingId: "b1" },
        { delay: expect.any(Number) },
      );
    });

    it("is idempotent - replaying the same webhook twice does not double-process", async () => {
      midtrans.verifySignature.mockReturnValue(true);
      prisma.transaction.findUnique.mockResolvedValue(makeTransaction({ status: "PAID" }));

      await service.handleWebhook(basePayload);

      expect(prisma.transaction.update).not.toHaveBeenCalled();
      expect(prisma.booking.update).not.toHaveBeenCalled();
      expect(notifications.send).not.toHaveBeenCalled();
    });

    it("marks the transaction FAILED on a denied/cancelled/expired payment, leaving the booking recoverable", async () => {
      midtrans.verifySignature.mockReturnValue(true);
      prisma.transaction.findUnique.mockResolvedValue(makeTransaction());

      await service.handleWebhook({ ...basePayload, transaction_status: "deny" });

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: "tx1" },
        data: { status: "FAILED" },
      });
      expect(prisma.booking.update).not.toHaveBeenCalled();
      expect(notifications.send).toHaveBeenCalledWith("student-user-1", "PAYMENT_FAILED", {
        bookingId: "b1",
      });
    });

    it("does not treat a captured-but-fraud-challenged transaction as success", async () => {
      midtrans.verifySignature.mockReturnValue(true);
      prisma.transaction.findUnique.mockResolvedValue(makeTransaction());

      await service.handleWebhook({
        ...basePayload,
        transaction_status: "capture",
        fraud_status: "challenge",
      });

      expect(prisma.transaction.update).not.toHaveBeenCalled();
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it("does nothing for an unknown order_id", async () => {
      midtrans.verifySignature.mockReturnValue(true);
      prisma.transaction.findUnique.mockResolvedValue(null);

      await service.handleWebhook(basePayload);

      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it("leaves a still-pending transaction (e.g. awaiting VA payment) untouched", async () => {
      midtrans.verifySignature.mockReturnValue(true);
      prisma.transaction.findUnique.mockResolvedValue(makeTransaction());

      await service.handleWebhook({ ...basePayload, transaction_status: "pending" });

      expect(prisma.transaction.update).not.toHaveBeenCalled();
      expect(prisma.booking.update).not.toHaveBeenCalled();
      expect(notifications.send).not.toHaveBeenCalled();
    });
  });

  describe("commission calculation", () => {
    it("uses the default 15% rate when PLATFORM_COMMISSION_RATE isn't configured", async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "ACCEPTED",
        priceAmount: 100000,
        student: { userId: "student-user-1" },
        transaction: null,
      });
      prisma.transaction.create.mockResolvedValue({ id: "tx1", amount: 100000, commission: 15000 });
      midtrans.createSnapTransaction.mockResolvedValue({ token: "t", redirectUrl: "r" });

      await service.initiatePayment(studentUser, "b1");

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: { bookingId: "b1", amount: 100000, commission: 15000, status: "PENDING" },
      });
    });

    it("rounds to the nearest whole Rupiah for an odd amount", async () => {
      const customConfigService = new PaymentsService(
        prisma as unknown as PrismaService,
        makeConfig({ PLATFORM_COMMISSION_RATE: "0.15" }),
        midtrans as unknown as MidtransService,
        notifications as unknown as NotificationsService,
        queue as unknown as Queue,
        autoCompleteQueue as unknown as Queue,
      );
      prisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "ACCEPTED",
        priceAmount: 33333,
        student: { userId: "student-user-1" },
        transaction: null,
      });
      prisma.transaction.create.mockResolvedValue({ id: "tx1" });
      midtrans.createSnapTransaction.mockResolvedValue({ token: "t", redirectUrl: "r" });

      await customConfigService.initiatePayment(studentUser, "b1");

      // 33333 * 0.15 = 4999.95 -> rounds to 5000, never silently truncated.
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: { bookingId: "b1", amount: 33333, commission: 5000, status: "PENDING" },
      });
    });

    it("respects a configured commission rate override", async () => {
      const customService = new PaymentsService(
        prisma as unknown as PrismaService,
        makeConfig({ PLATFORM_COMMISSION_RATE: "0.2" }),
        midtrans as unknown as MidtransService,
        notifications as unknown as NotificationsService,
        queue as unknown as Queue,
        autoCompleteQueue as unknown as Queue,
      );
      prisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "ACCEPTED",
        priceAmount: 100000,
        student: { userId: "student-user-1" },
        transaction: null,
      });
      prisma.transaction.create.mockResolvedValue({ id: "tx1" });
      midtrans.createSnapTransaction.mockResolvedValue({ token: "t", redirectUrl: "r" });

      await customService.initiatePayment(studentUser, "b1");

      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: { bookingId: "b1", amount: 100000, commission: 20000, status: "PENDING" },
      });
    });
  });
});
