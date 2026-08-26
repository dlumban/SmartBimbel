import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface BalanceSummary {
  totalEarned: number;
  availableBalance: number;
  pendingBalance: number;
}

// Payout statuses that reserve funds against the available balance - a
// PENDING/PROCESSING request already earmarks that money (can't be
// requested twice), and a COMPLETED one has genuinely left the ledger.
// Only FAILED payouts release the reservation.
const RESERVING_PAYOUT_STATUSES = ["PENDING", "PROCESSING", "COMPLETED"] as const;

@Injectable()
export class EarningsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Available balance only counts COMPLETED-session transactions (Task
   * 5.4's explicit AC) - CONFIRMED (paid but not yet taught) sits in
   * `pendingBalance` instead. COMPLETED isn't reachable until Sprint 6
   * wires up session completion, so `availableBalance` is correctly zero
   * for every tutor until then - not a placeholder to revisit, the query
   * itself is already right.
   */
  async getBalanceSummary(tutorProfileId: string): Promise<BalanceSummary> {
    const [completedAgg, pendingAgg, payoutsAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { status: "PAID", booking: { tutorId: tutorProfileId, status: "COMPLETED" } },
        _sum: { amount: true, commission: true },
      }),
      this.prisma.transaction.aggregate({
        where: { status: "PAID", booking: { tutorId: tutorProfileId, status: "CONFIRMED" } },
        _sum: { amount: true, commission: true },
      }),
      this.prisma.payout.aggregate({
        where: { tutorId: tutorProfileId, status: { in: [...RESERVING_PAYOUT_STATUSES] } },
        _sum: { amount: true },
      }),
    ]);

    const completedNet = (completedAgg._sum.amount ?? 0) - (completedAgg._sum.commission ?? 0);
    const pendingNet = (pendingAgg._sum.amount ?? 0) - (pendingAgg._sum.commission ?? 0);
    const reserved = payoutsAgg._sum.amount ?? 0;

    return {
      totalEarned: completedNet,
      availableBalance: Math.max(0, completedNet - reserved),
      pendingBalance: pendingNet,
    };
  }
}
