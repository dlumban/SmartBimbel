import { AdminTransactionsService } from "./admin-transactions.service";
import { PrismaService } from "../prisma/prisma.service";
import { PAYMENT_WINDOW_HOURS } from "../payments/payments.service";

describe("AdminTransactionsService", () => {
  let prisma: {
    transaction: { findMany: jest.Mock; count: jest.Mock };
  };
  let service: AdminTransactionsService;

  beforeEach(() => {
    prisma = {
      transaction: { findMany: jest.fn(), count: jest.fn() },
    };
    service = new AdminTransactionsService(prisma as unknown as PrismaService);
  });

  describe("list", () => {
    it("filters by status and date range, and paginates", async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.list({ status: "PAID", from: "2026-08-01", to: "2026-08-10" });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: "PAID",
            createdAt: { gte: new Date("2026-08-01"), lte: new Date("2026-08-10") },
          },
        }),
      );
    });
  });

  describe("reconciliation", () => {
    it("flags PENDING transactions older than the payment window", async () => {
      const stale = { id: "tx1", status: "PENDING", createdAt: new Date(0) };
      prisma.transaction.findMany.mockResolvedValue([stale]);

      const result = await service.reconciliation();

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "PENDING", createdAt: { lt: expect.any(Date) } },
        }),
      );
      const call = prisma.transaction.findMany.mock.calls[0][0];
      const thresholdMs = Date.now() - call.where.createdAt.lt.getTime();
      // Within a small tolerance of the documented window (guards against
      // flakiness from the few ms between Date.now() calls).
      expect(Math.abs(thresholdMs - PAYMENT_WINDOW_HOURS * 60 * 60 * 1000)).toBeLessThan(5000);

      expect(result.data).toEqual([stale]);
      expect(result.total).toBe(1);
      expect(result.staleThresholdHours).toBe(PAYMENT_WINDOW_HOURS);
    });
  });
});
