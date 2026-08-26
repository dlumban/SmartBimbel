import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { BOOKING_EXPIRY_QUEUE } from "../../jobs/jobs.module";

const BOOKING_INCLUDE = {
  student: { select: { userId: true } },
  tutor: { select: { userId: true } },
} as const;

@Processor(BOOKING_EXPIRY_QUEUE)
export class BookingExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingExpiryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<{ bookingId: string }>): Promise<void> {
    const { bookingId } = job.data;
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    });

    if (!booking) {
      this.logger.warn(`Booking ${bookingId} no longer exists - nothing to expire.`);
      return;
    }

    // Only REQUESTED/COUNTER_PROPOSED bookings expire - if the tutor
    // already acted (accepted/declined) or the booking moved on, this job
    // is a no-op rather than clobbering a since-changed status.
    if (booking.status !== "REQUESTED" && booking.status !== "COUNTER_PROPOSED") {
      return;
    }

    // Double-check against the deadline rather than trusting the delay
    // alone - guards against clock drift and makes the job idempotent if
    // it's ever re-run early for any reason.
    if (booking.respondByAt && booking.respondByAt.getTime() > Date.now()) {
      return;
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: "EXPIRED" },
    });
    await this.prisma.bookingStatusHistory.create({
      data: { bookingId, fromStatus: booking.status, toStatus: "EXPIRED" },
    });
    await this.notifications.send(booking.student.userId, "BOOKING_EXPIRED", { bookingId });
    await this.notifications.send(booking.tutor.userId, "BOOKING_EXPIRED", { bookingId });
    this.logger.log(`Booking ${bookingId} expired after no tutor response.`);
  }
}
