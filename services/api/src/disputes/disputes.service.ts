import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MidtransService } from "../payments/midtrans.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { RaiseDisputeDto } from "./dto/raise-dispute.dto";
import { ResolveDisputeDto } from "./dto/resolve-dispute.dto";

const DISPUTE_INCLUDE = {
  booking: {
    include: {
      student: { include: { user: true } },
      tutor: { include: { user: true } },
      transaction: true,
    },
  },
} as const;

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly midtrans: MidtransService,
    private readonly auditLog: AuditLogService,
  ) {}

  async raise(user: User, bookingId: string, dto: RaiseDisputeDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { student: true, tutor: true, transaction: true },
    });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    if (booking.student.userId !== user.id && booking.tutor.userId !== user.id) {
      throw new ForbiddenException("You are not a participant in this booking.");
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        bookingId,
        transactionId: booking.transaction?.id,
        raisedByUserId: user.id,
        reason: dto.reason,
        status: "OPEN",
      },
    });

    const otherPartyUserId =
      booking.student.userId === user.id ? booking.tutor.userId : booking.student.userId;
    await this.notifications.send(otherPartyUserId, "DISPUTE_RAISED", {
      disputeId: dispute.id,
      bookingId,
    });

    return dispute;
  }

  async resolve(admin: User, disputeId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: DISPUTE_INCLUDE,
    });
    if (!dispute) {
      throw new NotFoundException("No dispute with that id exists.");
    }
    if (dispute.status === "RESOLVED_REFUND" || dispute.status === "RESOLVED_NO_REFUND") {
      throw new BadRequestException("This dispute has already been resolved.");
    }

    if (dto.status === "RESOLVED_REFUND") {
      const transaction = dispute.booking.transaction;
      if (!transaction || transaction.status !== "PAID") {
        throw new BadRequestException(
          "Cannot refund a booking with no successful payment to refund.",
        );
      }
      if (!transaction.gatewayRef) {
        throw new BadRequestException("Missing payment gateway reference - cannot process refund.");
      }

      const refundAmount = dto.refundAmount ?? transaction.amount;
      if (refundAmount > transaction.amount) {
        throw new BadRequestException("Refund amount cannot exceed the original payment amount.");
      }

      await this.midtrans.refund(transaction.gatewayRef, refundAmount, dto.resolutionNotes);
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "REFUNDED", refundedAmount: refundAmount },
      });
    }

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: dto.status,
        resolutionNotes: dto.resolutionNotes,
        resolvedByUserId: admin.id,
        resolvedAt: new Date(),
      },
      include: DISPUTE_INCLUDE,
    });

    await this.notifications.send(dispute.booking.student.userId, "DISPUTE_RESOLVED", {
      disputeId,
      bookingId: dispute.bookingId,
    });
    await this.notifications.send(dispute.booking.tutor.userId, "DISPUTE_RESOLVED", {
      disputeId,
      bookingId: dispute.bookingId,
    });
    await this.auditLog.log(admin.id, "dispute.resolve", "Dispute", disputeId, {
      status: dto.status,
      resolutionNotes: dto.resolutionNotes,
    });

    return updated;
  }

  async listForBooking(user: User, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { student: true, tutor: true },
    });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    if (booking.student.userId !== user.id && booking.tutor.userId !== user.id) {
      throw new ForbiddenException("You are not a participant in this booking.");
    }
    return this.prisma.dispute.findMany({ where: { bookingId }, orderBy: { createdAt: "desc" } });
  }

  async listAll() {
    return this.prisma.dispute.findMany({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
      include: DISPUTE_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
  }

  // Reported chat messages/users from Sprint 4 (Task 4.4) surfaced in the
  // same trust-and-safety admin surface as disputes (Task 7.5's own scope
  // note) - a report isn't always tied to a formal dispute, so this reads
  // MessageReport directly rather than joining through Dispute.
  async listReports() {
    return this.prisma.messageReport.findMany({
      include: {
        reporter: { select: { id: true, name: true } },
        reportedUser: { select: { id: true, name: true } },
        message: { select: { id: true, body: true } },
        conversation: { select: { bookingId: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
