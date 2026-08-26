import { Job } from "bullmq";
import { BookingExpiryProcessor } from "./booking-expiry.processor";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";

function makeJob(bookingId: string): Job<{ bookingId: string }> {
  return { data: { bookingId } } as Job<{ bookingId: string }>;
}

describe("BookingExpiryProcessor", () => {
  let prisma: {
    booking: { findUnique: jest.Mock; update: jest.Mock };
    bookingStatusHistory: { create: jest.Mock };
  };
  let notifications: { send: jest.Mock };
  let processor: BookingExpiryProcessor;

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn(), update: jest.fn() },
      bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    notifications = { send: jest.fn().mockResolvedValue({}) };
    processor = new BookingExpiryProcessor(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it("does nothing if the booking no longer exists", async () => {
    prisma.booking.findUnique.mockResolvedValue(null);
    await processor.process(makeJob("b1"));
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it("does nothing if the booking already moved past REQUESTED/COUNTER_PROPOSED", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "ACCEPTED",
      respondByAt: new Date(Date.now() - 1000),
      student: { userId: "s1" },
      tutor: { userId: "t1" },
    });
    await processor.process(makeJob("b1"));
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it("does nothing if the deadline hasn't actually passed yet", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "REQUESTED",
      respondByAt: new Date(Date.now() + 60_000),
      student: { userId: "s1" },
      tutor: { userId: "t1" },
    });
    await processor.process(makeJob("b1"));
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it("expires a REQUESTED booking past its deadline and notifies both participants", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "REQUESTED",
      respondByAt: new Date(Date.now() - 1000),
      student: { userId: "s1" },
      tutor: { userId: "t1" },
    });
    await processor.process(makeJob("b1"));
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { status: "EXPIRED" },
    });
    expect(prisma.bookingStatusHistory.create).toHaveBeenCalledWith({
      data: { bookingId: "b1", fromStatus: "REQUESTED", toStatus: "EXPIRED" },
    });
    expect(notifications.send).toHaveBeenCalledWith("s1", "BOOKING_EXPIRED", { bookingId: "b1" });
    expect(notifications.send).toHaveBeenCalledWith("t1", "BOOKING_EXPIRED", { bookingId: "b1" });
  });

  it("expires a COUNTER_PROPOSED booking past its deadline", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "COUNTER_PROPOSED",
      respondByAt: new Date(Date.now() - 1000),
      student: { userId: "s1" },
      tutor: { userId: "t1" },
    });
    await processor.process(makeJob("b1"));
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { status: "EXPIRED" },
    });
  });
});
