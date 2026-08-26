import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { SESSION_REMINDER_QUEUE } from "../../jobs/jobs.module";

export interface SessionReminderJobData {
  bookingId: string;
  reminderType: "24H" | "1H";
  // The scheduledAt this reminder was scheduled against, ISO string -
  // guards against a since-rescheduled or since-cancelled session (Task
  // 3.5 schedules a fresh pair of reminders whenever a reschedule is
  // accepted, so a stale one for the old time must no-op).
  expectedScheduledAt: string;
}

@Processor(SESSION_REMINDER_QUEUE)
export class SessionReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(SessionReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<SessionReminderJobData>): Promise<void> {
    const { bookingId, reminderType, expectedScheduledAt } = job.data;
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { student: true, tutor: true },
    });

    if (!booking) {
      this.logger.warn(`Booking ${bookingId} no longer exists - skipping reminder.`);
      return;
    }
    if (booking.status !== "ACCEPTED") {
      return;
    }
    if (booking.scheduledAt.toISOString() !== expectedScheduledAt) {
      return;
    }

    const type = reminderType === "24H" ? "BOOKING_REMINDER_24H" : "BOOKING_REMINDER_1H";
    await this.notifications.send(booking.student.userId, type, { bookingId });
    await this.notifications.send(booking.tutor.userId, type, { bookingId });
  }
}
