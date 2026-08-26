import { BadRequestException, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { AdminBookingsService } from "./admin-bookings.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";

describe("AdminBookingsService", () => {
  let prisma: {
    booking: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    bookingStatusHistory: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditLog: { log: jest.Mock };
  let notifications: { send: jest.Mock };
  let service: AdminBookingsService;

  const admin = { id: "admin-1" } as User;

  function makeBooking(overrides: Record<string, unknown> = {}) {
    return {
      id: "b1",
      status: "ACCEPTED",
      student: { userId: "student-1" },
      tutor: { userId: "tutor-1" },
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      booking: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      bookingStatusHistory: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    auditLog = { log: jest.fn().mockResolvedValue({}) };
    notifications = { send: jest.fn().mockResolvedValue({}) };
    service = new AdminBookingsService(
      prisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      notifications as unknown as NotificationsService,
    );
  });

  describe("search", () => {
    it("filters by status/city/subjectId/date range/q and paginates", async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await service.search({ status: "CONFIRMED", city: "Jakarta", subjectId: "s1", q: "Budi" });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "CONFIRMED",
            subjectId: "s1",
            tutor: { city: { equals: "Jakarta", mode: "insensitive" } },
          }),
        }),
      );
    });
  });

  describe("detail", () => {
    it("throws NotFoundException for an unknown booking", async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.detail("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns a booking regardless of participant membership", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      const result = await service.detail("b1");
      expect(result.id).toBe("b1");
    });
  });

  describe("overrideCancel", () => {
    it("throws NotFoundException for an unknown booking", async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(
        service.overrideCancel(admin, "missing", { reason: "test" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException for a booking already in a terminal state", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
      await expect(
        service.overrideCancel(admin, "b1", { reason: "test" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("force-cancels a non-terminal booking, notifies both parties, and audit-logs it", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
      prisma.booking.update.mockResolvedValue(makeBooking({ status: "CANCELLED" }));

      const result = await service.overrideCancel(admin, "b1", { reason: "Edge case" });

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancelledByUserId: "admin-1",
          cancellationReason: "Edge case",
          isLateCancellation: false,
        }),
        include: expect.anything(),
      });
      expect(notifications.send).toHaveBeenCalledWith("student-1", "BOOKING_CANCELLED", {
        bookingId: "b1",
        isLateCancellation: false,
      });
      expect(notifications.send).toHaveBeenCalledWith("tutor-1", "BOOKING_CANCELLED", {
        bookingId: "b1",
        isLateCancellation: false,
      });
      expect(auditLog.log).toHaveBeenCalledWith(admin.id, "booking.override_cancel", "Booking", "b1", {
        reason: "Edge case",
        fromStatus: "CONFIRMED",
      });
      expect(result.status).toBe("CANCELLED");
    });
  });
});
