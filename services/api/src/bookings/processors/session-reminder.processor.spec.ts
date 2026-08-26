import { Job } from "bullmq";
import { SessionReminderProcessor, SessionReminderJobData } from "./session-reminder.processor";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";

function makeJob(data: SessionReminderJobData): Job<SessionReminderJobData> {
  return { data } as Job<SessionReminderJobData>;
}

describe("SessionReminderProcessor", () => {
  let prisma: { booking: { findUnique: jest.Mock } };
  let notifications: { send: jest.Mock };
  let processor: SessionReminderProcessor;

  const scheduledAt = new Date("2026-09-01T09:00:00.000Z");

  beforeEach(() => {
    prisma = { booking: { findUnique: jest.fn() } };
    notifications = { send: jest.fn().mockResolvedValue({}) };
    processor = new SessionReminderProcessor(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it("does nothing if the booking no longer exists", async () => {
    prisma.booking.findUnique.mockResolvedValue(null);
    await processor.process(
      makeJob({ bookingId: "b1", reminderType: "24H", expectedScheduledAt: scheduledAt.toISOString() }),
    );
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it("does nothing if the booking is no longer ACCEPTED (e.g. cancelled)", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "CANCELLED",
      scheduledAt,
      student: { userId: "s1" },
      tutor: { userId: "t1" },
    });
    await processor.process(
      makeJob({ bookingId: "b1", reminderType: "24H", expectedScheduledAt: scheduledAt.toISOString() }),
    );
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it("does nothing if the session has since been rescheduled to a different time", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "ACCEPTED",
      scheduledAt: new Date("2026-09-08T09:00:00.000Z"), // different from expectedScheduledAt
      student: { userId: "s1" },
      tutor: { userId: "t1" },
    });
    await processor.process(
      makeJob({ bookingId: "b1", reminderType: "24H", expectedScheduledAt: scheduledAt.toISOString() }),
    );
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it("notifies both participants for a still-valid 24h reminder", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "ACCEPTED",
      scheduledAt,
      student: { userId: "s1" },
      tutor: { userId: "t1" },
    });
    await processor.process(
      makeJob({ bookingId: "b1", reminderType: "24H", expectedScheduledAt: scheduledAt.toISOString() }),
    );
    expect(notifications.send).toHaveBeenCalledWith("s1", "BOOKING_REMINDER_24H", { bookingId: "b1" });
    expect(notifications.send).toHaveBeenCalledWith("t1", "BOOKING_REMINDER_24H", { bookingId: "b1" });
  });

  it("notifies both participants for a still-valid 1h reminder", async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "ACCEPTED",
      scheduledAt,
      student: { userId: "s1" },
      tutor: { userId: "t1" },
    });
    await processor.process(
      makeJob({ bookingId: "b1", reminderType: "1H", expectedScheduledAt: scheduledAt.toISOString() }),
    );
    expect(notifications.send).toHaveBeenCalledWith("s1", "BOOKING_REMINDER_1H", { bookingId: "b1" });
    expect(notifications.send).toHaveBeenCalledWith("t1", "BOOKING_REMINDER_1H", { bookingId: "b1" });
  });
});
