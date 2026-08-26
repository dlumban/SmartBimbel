import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PayoutStatus, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EarningsService } from "../payments/earnings.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { SetBankDetailsDto } from "./dto/set-bank-details.dto";
import { RequestPayoutDto } from "./dto/request-payout.dto";
import { UpdatePayoutStatusDto } from "./dto/update-payout-status.dto";

// Product decision (Task 5.5's own technical note: "document the chosen
// value") - avoids excessive small transfers eating into what a
// semi-manual, admin-processed payout flow can reasonably handle at MVP
// operational volume.
export const MINIMUM_PAYOUT_AMOUNT_IDR = 50_000;

// Linear state machine (Task 5.5) - a payout can only move forward, never
// backward, and a terminal state (COMPLETED/FAILED) never changes again.
const VALID_NEXT_STATUSES: Record<PayoutStatus, PayoutStatus[]> = {
  PENDING: ["PROCESSING", "FAILED"],
  PROCESSING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
};

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly earnings: EarningsService,
    private readonly notifications: NotificationsService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async getTutorProfile(user: User) {
    const tutorProfile = await this.prisma.tutorProfile.findUnique({ where: { userId: user.id } });
    if (!tutorProfile) {
      throw new NotFoundException("No tutor profile exists for this account yet.");
    }
    return tutorProfile;
  }

  async setBankDetails(user: User, dto: SetBankDetailsDto) {
    const tutorProfile = await this.getTutorProfile(user);
    return this.prisma.tutorProfile.update({
      where: { id: tutorProfile.id },
      data: {
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        bankAccountHolderName: dto.bankAccountHolderName,
      },
    });
  }

  async requestPayout(user: User, dto: RequestPayoutDto) {
    const tutorProfile = await this.getTutorProfile(user);
    if (
      !tutorProfile.bankName ||
      !tutorProfile.bankAccountNumber ||
      !tutorProfile.bankAccountHolderName
    ) {
      throw new BadRequestException("Set your bank account details before requesting a payout.");
    }
    if (dto.amount < MINIMUM_PAYOUT_AMOUNT_IDR) {
      throw new BadRequestException(
        `The minimum payout amount is Rp${MINIMUM_PAYOUT_AMOUNT_IDR.toLocaleString("id-ID")}.`,
      );
    }

    const { availableBalance } = await this.earnings.getBalanceSummary(tutorProfile.id);
    if (dto.amount > availableBalance) {
      throw new BadRequestException("Requested amount exceeds your available balance.");
    }

    const payout = await this.prisma.payout.create({
      data: {
        tutorId: tutorProfile.id,
        amount: dto.amount,
        status: "PENDING",
        bankName: tutorProfile.bankName,
        bankAccountNumber: tutorProfile.bankAccountNumber,
        bankAccountHolderName: tutorProfile.bankAccountHolderName,
      },
    });

    await this.notifications.send(user.id, "PAYOUT_REQUESTED", { payoutId: payout.id });
    return payout;
  }

  async listMyPayouts(user: User) {
    const tutorProfile = await this.getTutorProfile(user);
    return this.prisma.payout.findMany({
      where: { tutorId: tutorProfile.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateStatus(admin: User, payoutId: string, dto: UpdatePayoutStatusDto) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: { tutor: { include: { user: true } } },
    });
    if (!payout) {
      throw new NotFoundException("No payout with that id exists.");
    }
    if (!VALID_NEXT_STATUSES[payout.status].includes(dto.status)) {
      throw new BadRequestException(`Cannot move a payout from ${payout.status} to ${dto.status}.`);
    }
    if (dto.status === "FAILED" && !dto.failureReason) {
      throw new BadRequestException("failureReason is required when marking a payout as failed.");
    }

    const updated = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: dto.status,
        processedByUserId: admin.id,
        processedAt:
          dto.status === "COMPLETED" || dto.status === "FAILED" ? new Date() : payout.processedAt,
        failureReason: dto.status === "FAILED" ? dto.failureReason : payout.failureReason,
      },
    });

    await this.notifications.send(payout.tutor.user.id, "PAYOUT_STATUS_CHANGED", {
      payoutId,
      status: dto.status,
    });
    await this.auditLog.log(admin.id, "payout.update_status", "Payout", payoutId, {
      fromStatus: payout.status,
      toStatus: dto.status,
      failureReason: dto.failureReason,
    });

    return updated;
  }

  async listPending() {
    return this.prisma.payout.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      include: { tutor: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    });
  }
}
