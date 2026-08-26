import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { SESSION_AUTO_COMPLETE_QUEUE } from "../../jobs/jobs.module";

export interface SessionAutoCompleteJobData {
  bookingId: string;
}

const BOOKING_INCLUDE = {
  student: { select: { userId: true } },
} as const;

/**
 * Safety net (Task 6.1's own note: "treat this as required, not optional")
 * so a busy/inattentive tutor never permanently blocks their own payout
 * eligibility or the student's ability to review just by forgetting to tap
 * "Tandai Selesai" - scheduled by PaymentsService the moment a booking
 * becomes CONFIRMED, fires SESSION_AUTO_COMPLETE_GRACE_HOURS after the
 * session's scheduled end time.
 */
@Processor(SESSION_AUTO_COMPLETE_QUEUE)
export class SessionAutoCompleteProcessor extends WorkerHost {
  private readonly logger = new Logger(SessionAutoCompleteProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<SessionAutoCompleteJobData>): Promise<void> {
    const { bookingId } = job.data;
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      this.logger.warn(`Booking ${bookingId} no longer exists - skipping auto-complete.`);
      return;
    }

    // Idempotent no-op if the tutor already marked it complete manually, or
    // the booking moved on some other way (cancellation, dispute, etc.) in
    // the meantime - this job never clobbers a since-changed status.
    if (booking.status !== "CONFIRMED") {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
      this.prisma.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: "CONFIRMED",
          toStatus: "COMPLETED",
          reason: "Otomatis diselesaikan setelah tidak ditandai selesai oleh tutor",
        },
      }),
    ]);

    await this.notifications.send(booking.student.userId, "REVIEW_PROMPT", { bookingId });
    this.logger.log(`Booking ${bookingId} auto-completed after the grace period.`);
  }
}
