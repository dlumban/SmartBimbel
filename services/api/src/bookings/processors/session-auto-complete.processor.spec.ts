import { Job } from "bullmq";
import { SessionAutoCompleteProcessor } from "./session-auto-complete.processor";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";

function makeJob(bookingId: string): Job<{ bookingId: string }> {
  return { data: { bookingId } } as Job<{ bookingId: string }>;
}

describe("SessionAutoCompleteProcessor", () => {
  let prisma: {
    booking: { findUnique: jest.Mock; update: jest.Mock };
    bookingStatusHistory: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let notifications: { send: jest.Mock };
  let processor: SessionAutoCompleteProcessor;

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn(), update: jest.fn() },
      bookingStatusHistory: { create: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    notifications = { send: jest.fn().mockResolvedValue({}) };
    processor = new SessionAutoCompleteProcessor(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it("does nothing if the booking no longer exists", async () => {
    prisma.booking.findUnique.mockResolvedValue(null);
    await processor.process(makeJob("b1"));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does nothing if the booking is no longer CONFIRMED (already completed/cancelled/etc)", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "COMPLETED",
      student: { userId: "s1" },
    });
    await processor.process(makeJob("b1"));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("auto-completes a CONFIRMED booking and notifies the student to review", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "CONFIRMED",
      student: { userId: "s1" },
    });

    await processor.process(makeJob("b1"));

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    });
    expect(prisma.bookingStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ bookingId: "b1", fromStatus: "CONFIRMED", toStatus: "COMPLETED" }),
    });
    expect(notifications.send).toHaveBeenCalledWith("s1", "REVIEW_PROMPT", { bookingId: "b1" });
  });
});
