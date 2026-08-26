import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MidtransService } from "./midtrans.service";
import { MidtransWebhookDto } from "./dto/midtrans-webhook.dto";
import { ListTransactionsDto } from "./dto/list-transactions.dto";
import { PAYMENT_EXPIRY_QUEUE, SESSION_AUTO_COMPLETE_QUEUE } from "../jobs/jobs.module";
import { SESSION_AUTO_COMPLETE_GRACE_HOURS } from "@smartbimbel/shared";

// Confirmed default per PRD §6.1.E/§11 ("Configurable platform
// commission... default 15%") - configurable via env var since PRD §14
// flags the final rate as still an open product question, without
// blocking this task on that decision the way Task 3.5's cancellation
// window explicitly required (that one named "confirm with stakeholder
// before implementation"; this one only says "keep it configurable").
const DEFAULT_COMMISSION_RATE = 0.15;

// Mirrors RESPONSE_WINDOW_HOURS's precedent (Task 3.2) - a defined,
// documented value rather than an unbounded wait, per Task 5.2's own
// requirement ("Unpaid ACCEPTED bookings expire after the defined
// timeout, releasing the slot").
export const PAYMENT_WINDOW_HOURS = 24;

const TRANSACTION_INCLUDE = {
  booking: {
    include: {
      student: { include: { user: true } },
      tutor: { include: { user: true } },
      subject: true,
    },
  },
} as const;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly midtrans: MidtransService,
    private readonly notifications: NotificationsService,
    @InjectQueue(PAYMENT_EXPIRY_QUEUE) private readonly expiryQueue: Queue,
    @InjectQueue(SESSION_AUTO_COMPLETE_QUEUE) private readonly autoCompleteQueue: Queue,
  ) {}

  private computeCommission(amount: number): number {
    const rate = Number(this.config.get<string>("PLATFORM_COMMISSION_RATE") ?? DEFAULT_COMMISSION_RATE);
    // IDR has no subunits in practice - round to the nearest whole Rupiah
    // rather than truncating, so commission never silently underestimates
    // by up to a full unit across many transactions.
    return Math.round(amount * rate);
  }

  async schedulePaymentExpiry(bookingId: string): Promise<void> {
    await this.expiryQueue.add(
      "expire-unpaid-booking",
      { bookingId },
      { delay: PAYMENT_WINDOW_HOURS * 60 * 60 * 1000 },
    );
  }

  // Auto-complete safety net (Sprint 6, Task 6.1) - scheduled the moment a
  // booking is actually confirmed (paid), not at acceptance time, since
  // only a paid session can ever legitimately reach COMPLETED. Delay is
  // clamped at zero so a booking whose session time has already passed by
  // the time payment clears (a slow/retried payment) still gets a
  // near-immediate safety-net completion rather than a negative delay.
  private async scheduleSessionAutoComplete(
    bookingId: string,
    scheduledAt: Date,
    durationMinutes: number,
  ): Promise<void> {
    const scheduledEnd = scheduledAt.getTime() + durationMinutes * 60 * 1000;
    const delay = Math.max(
      0,
      scheduledEnd + SESSION_AUTO_COMPLETE_GRACE_HOURS * 60 * 60 * 1000 - Date.now(),
    );
    await this.autoCompleteQueue.add("auto-complete-session", { bookingId }, { delay });
  }

  async initiatePayment(
    user: User,
    bookingId: string,
  ): Promise<{ token: string; redirectUrl: string; transactionId: string }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { student: true, transaction: true },
    });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    if (booking.student.userId !== user.id) {
      throw new ForbiddenException("Only the student who requested this booking can pay for it.");
    }
    if (booking.status !== "ACCEPTED") {
      throw new BadRequestException(`Cannot pay for a booking in ${booking.status} state.`);
    }
    if (booking.priceAmount == null) {
      throw new BadRequestException("This booking has no price set.");
    }
    if (booking.transaction?.status === "PAID") {
      throw new BadRequestException("This booking has already been paid for.");
    }

    // Reuse the existing PENDING transaction on a retry (e.g. the student
    // abandoned the first Snap page) rather than creating a duplicate
    // ledger row for the same booking - Transaction.bookingId is unique.
    const transaction =
      booking.transaction ??
      (await this.prisma.transaction.create({
        data: {
          bookingId: booking.id,
          amount: booking.priceAmount,
          commission: this.computeCommission(booking.priceAmount),
          status: "PENDING",
        },
      }));

    const { token, redirectUrl } = await this.midtrans.createSnapTransaction(
      transaction.id,
      transaction.amount,
    );

    return { token, redirectUrl, transactionId: transaction.id };
  }

  async handleWebhook(payload: MidtransWebhookDto): Promise<void> {
    const validSignature = this.midtrans.verifySignature({
      orderId: payload.order_id,
      statusCode: payload.status_code,
      grossAmount: payload.gross_amount,
      signatureKey: payload.signature_key,
    });
    if (!validSignature) {
      throw new UnauthorizedException("Invalid Midtrans webhook signature.");
    }

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: payload.order_id },
      include: TRANSACTION_INCLUDE,
    });
    if (!transaction) {
      this.logger.warn(`Webhook for unknown transaction ${payload.order_id} - ignoring.`);
      return;
    }

    // Idempotency (Task 5.1's explicit AC): a webhook already processed
    // to PAID (or a still-relevant terminal state) must never be
    // reprocessed, however many times Midtrans retries delivery.
    if (transaction.status === "PAID" || transaction.status === "REFUNDED") {
      return;
    }

    const isSuccess =
      ["capture", "settlement"].includes(payload.transaction_status) &&
      (payload.fraud_status === undefined || payload.fraud_status === "accept");
    const isFailure = ["deny", "cancel", "expire"].includes(payload.transaction_status);

    if (isSuccess) {
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "PAID", gatewayRef: payload.transaction_id, paidAt: new Date() },
        });
        await tx.booking.update({
          where: { id: transaction.bookingId },
          data: { status: "CONFIRMED" },
        });
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: transaction.bookingId,
            fromStatus: "ACCEPTED",
            toStatus: "CONFIRMED",
            reason: "Pembayaran berhasil",
          },
        });
      });

      await this.notifications.send(transaction.booking.student.userId, "BOOKING_CONFIRMED", {
        bookingId: transaction.bookingId,
      });
      await this.notifications.send(transaction.booking.tutor.userId, "BOOKING_CONFIRMED", {
        bookingId: transaction.bookingId,
      });
      await this.scheduleSessionAutoComplete(
        transaction.bookingId,
        transaction.booking.scheduledAt,
        transaction.booking.durationMinutes,
      );
    } else if (isFailure) {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "FAILED" },
      });
      await this.notifications.send(transaction.booking.student.userId, "PAYMENT_FAILED", {
        bookingId: transaction.bookingId,
      });
    }
    // Any other transaction_status (e.g. "pending" while a student is
    // still completing a VA/QRIS payment) is a genuine no-op - wait for
    // the next webhook delivery instead of guessing at a final state.
  }

  async listTransactions(user: User, query: ListTransactionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    let scopeWhere: Prisma.TransactionWhereInput;
    if (user.role === "STUDENT") {
      const studentProfile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
      });
      if (!studentProfile) return { data: [], total: 0, page, limit };
      scopeWhere = { booking: { studentId: studentProfile.id } };
    } else if (user.role === "TUTOR") {
      const tutorProfile = await this.prisma.tutorProfile.findUnique({
        where: { userId: user.id },
      });
      if (!tutorProfile) return { data: [], total: 0, page, limit };
      scopeWhere = { booking: { tutorId: tutorProfile.id } };
    } else {
      return { data: [], total: 0, page, limit };
    }

    const where: Prisma.TransactionWhereInput = {
      AND: [
        scopeWhere,
        query.status ? { status: query.status } : {},
        query.from ? { createdAt: { gte: new Date(query.from) } } : {},
        query.to ? { createdAt: { lte: new Date(query.to) } } : {},
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: TRANSACTION_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
