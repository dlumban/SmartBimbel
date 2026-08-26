import { Job } from "bullmq";
import { PaymentExpiryProcessor } from "./payment-expiry.processor";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";

function makeJob(bookingId: string): Job<{ bookingId: string }> {
  return { data: { bookingId } } as Job<{ bookingId: string }>;
}

describe("PaymentExpiryProcessor", () => {
  let prisma: {
    booking: { findUnique: jest.Mock; update: jest.Mock };
    bookingStatusHistory: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let notifications: { send: jest.Mock };
  let processor: PaymentExpiryProcessor;

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn(), update: jest.fn() },
      bookingStatusHistory: { create: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    notifications = { send: jest.fn().mockResolvedValue({}) };
    processor = new PaymentExpiryProcessor(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it("does nothing if the booking no longer exists", async () => {
    prisma.booking.findUnique.mockResolvedValue(null);
    await processor.process(makeJob("b1"));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does nothing if the booking is no longer ACCEPTED (e.g. already paid/cancelled)", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "CONFIRMED",
      student: { userId: "s1" },
      tutor: { userId: "t1" },
      transaction: { status: "PAID" },
    });
    await processor.process(makeJob("b1"));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does nothing if a PAID transaction exists even though the booking read is stale ACCEPTED", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "ACCEPTED",
      student: { userId: "s1" },
      tutor: { userId: "t1" },
      transaction: { status: "PAID" },
    });
    await processor.process(makeJob("b1"));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("expires an unpaid ACCEPTED booking and notifies both participants", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "ACCEPTED",
      student: { userId: "s1" },
      tutor: { userId: "t1" },
      transaction: null,
    });

    await processor.process(makeJob("b1"));

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(notifications.send).toHaveBeenCalledWith("s1", "PAYMENT_FAILED", { bookingId: "b1" });
    expect(notifications.send).toHaveBeenCalledWith("t1", "BOOKING_EXPIRED", { bookingId: "b1" });
  });
});
