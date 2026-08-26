import { AuditLogService } from "./audit-log.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuditLogService", () => {
  let prisma: { auditLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock } };
  let service: AuditLogService;

  beforeEach(() => {
    prisma = {
      auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };
    service = new AuditLogService(prisma as unknown as PrismaService);
  });

  describe("log", () => {
    it("records the admin, action, target, and metadata", async () => {
      prisma.auditLog.create.mockResolvedValue({ id: "log1" });

      await service.log("admin-1", "payout.approve", "Payout", "payout-1", { amount: 100000 });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminUserId: "admin-1",
          action: "payout.approve",
          targetType: "Payout",
          targetId: "payout-1",
          metadata: { amount: 100000 },
        },
      });
    });
  });

  describe("list", () => {
    it("filters by targetType and adminUserId when given", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.list({ targetType: "Payout", adminUserId: "admin-1" });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetType: "Payout", adminUserId: "admin-1" },
        }),
      );
    });

    it("returns paginated results with defaults", async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: "log1" }]);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.list({});

      expect(result).toEqual({ data: [{ id: "log1" }], total: 1, page: 1, limit: 50 });
    });
  });
});
