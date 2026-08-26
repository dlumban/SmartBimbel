import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { PAYMENT_EXPIRY_QUEUE } from "../../jobs/jobs.module";

@Processor(PAYMENT_EXPIRY_QUEUE)
export class PaymentExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentExpiryProcessor.name);

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
      include: {
        student: { select: { userId: true } },
        tutor: { select: { userId: true } },
        transaction: { select: { status: true } },
      },
    });

    if (!booking) {
      this.logger.warn(`Booking ${bookingId} no longer exists - nothing to expire.`);
      return;
    }
    // Only an unpaid ACCEPTED booking times out - already paid (CONFIRMED),
    // cancelled, or otherwise moved-on bookings are a no-op, same
    // idempotency guard as BookingExpiryProcessor.
    if (booking.status !== "ACCEPTED") return;
    if (booking.transaction?.status === "PAID") return;

    await this.prisma.$transaction([
      this.prisma.booking.update({ where: { id: bookingId }, data: { status: "EXPIRED" } }),
      this.prisma.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: "ACCEPTED",
          toStatus: "EXPIRED",
          reason: "Pembayaran tidak diselesaikan dalam batas waktu",
        },
      }),
    ]);

    await this.notifications.send(booking.student.userId, "PAYMENT_FAILED", { bookingId });
    await this.notifications.send(booking.tutor.userId, "BOOKING_EXPIRED", { bookingId });
    this.logger.log(`Booking ${bookingId} expired after payment was not completed in time.`);
  }
}
