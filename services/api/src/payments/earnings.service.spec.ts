import { EarningsService } from "./earnings.service";
import { PrismaService } from "../prisma/prisma.service";

describe("EarningsService.getBalanceSummary", () => {
  let prisma: {
    transaction: { aggregate: jest.Mock };
    payout: { aggregate: jest.Mock };
  };
  let service: EarningsService;

  beforeEach(() => {
    prisma = {
      transaction: { aggregate: jest.fn() },
      payout: { aggregate: jest.fn() },
    };
    service = new EarningsService(prisma as unknown as PrismaService);
  });

  it("computes totalEarned/availableBalance from COMPLETED-session transactions only", async () => {
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 500000, commission: 75000 } }) // COMPLETED
      .mockResolvedValueOnce({ _sum: { amount: 0, commission: 0 } }); // CONFIRMED
    prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    const result = await service.getBalanceSummary("tp1");

    expect(result.totalEarned).toBe(425000);
    expect(result.availableBalance).toBe(425000);
    expect(result.pendingBalance).toBe(0);

    expect(prisma.transaction.aggregate).toHaveBeenNthCalledWith(1, {
      where: { status: "PAID", booking: { tutorId: "tp1", status: "COMPLETED" } },
      _sum: { amount: true, commission: true },
    });
  });

  it("puts CONFIRMED (paid, not yet completed) net earnings in pendingBalance, not availableBalance", async () => {
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 0, commission: 0 } }) // COMPLETED
      .mockResolvedValueOnce({ _sum: { amount: 200000, commission: 30000 } }); // CONFIRMED
    prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    const result = await service.getBalanceSummary("tp1");

    expect(result.availableBalance).toBe(0);
    expect(result.pendingBalance).toBe(170000);
  });

  it("subtracts non-FAILED payouts (PENDING/PROCESSING/COMPLETED) from available balance", async () => {
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 500000, commission: 75000 } })
      .mockResolvedValueOnce({ _sum: { amount: 0, commission: 0 } });
    prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 200000 } });

    const result = await service.getBalanceSummary("tp1");

    expect(result.availableBalance).toBe(225000); // 425000 - 200000
    expect(prisma.payout.aggregate).toHaveBeenCalledWith({
      where: { tutorId: "tp1", status: { in: ["PENDING", "PROCESSING", "COMPLETED"] } },
      _sum: { amount: true },
    });
  });

  it("never returns a negative available balance", async () => {
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 100000, commission: 15000 } })
      .mockResolvedValueOnce({ _sum: { amount: 0, commission: 0 } });
    prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: 999999 } });

    const result = await service.getBalanceSummary("tp1");

    expect(result.availableBalance).toBe(0);
  });

  it("handles a tutor with no transactions or payouts at all", async () => {
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null, commission: null } });
    prisma.payout.aggregate.mockResolvedValue({ _sum: { amount: null } });

    const result = await service.getBalanceSummary("tp1");

    expect(result).toEqual({ totalEarned: 0, availableBalance: 0, pendingBalance: 0 });
  });
});
