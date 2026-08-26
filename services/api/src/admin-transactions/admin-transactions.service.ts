import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PAYMENT_WINDOW_HOURS } from "../payments/payments.service";

const TRANSACTION_INCLUDE = {
  booking: {
    include: {
      student: { include: { user: true } },
      tutor: { include: { user: true } },
      subject: true,
    },
  },
} as const;

export interface ListAdminTransactionsQuery {
  status?: Prisma.TransactionWhereInput["status"];
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAdminTransactionsQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.TransactionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
      }),
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

  /**
   * Safety net for webhook delivery gaps (Task 7.4's own scope) - without
   * live access to Midtrans's own transaction-status API (no credentials
   * exist in this environment, same gate as everywhere else Midtrans is
   * touched), the best available signal from our own records is a
   * transaction that's been PENDING far longer than the documented
   * PAYMENT_WINDOW_HOURS payment window ever allows: either the webhook
   * never arrived, or the auto-expiry job silently failed to run. Both are
   * genuine "this disagrees with what should have happened" cases worth a
   * human look.
   */
  async reconciliation() {
    const staleBefore = new Date(Date.now() - PAYMENT_WINDOW_HOURS * 60 * 60 * 1000);
    const mismatched = await this.prisma.transaction.findMany({
      where: { status: "PENDING", createdAt: { lt: staleBefore } },
      include: TRANSACTION_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return {
      data: mismatched,
      total: mismatched.length,
      staleThresholdHours: PAYMENT_WINDOW_HOURS,
    };
  }
}
