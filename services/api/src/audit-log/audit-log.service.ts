import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  // Called from every admin-mutating action (Task 7.1's own AC) - never
  // allowed to fail the action it's logging, so callers await it after the
  // real mutation succeeds, not wrapped in the same transaction (a logging
  // failure should never roll back a legitimate admin action, and vice
  // versa a slow log write should never block the response).
  async log(
    adminUserId: string,
    action: string,
    targetType: string,
    targetId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.auditLog.create({
      data: { adminUserId, action, targetType, targetId, metadata },
    });
  }

  async list(query: { targetType?: string; adminUserId?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.AuditLogWhereInput = {
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.adminUserId ? { adminUserId: query.adminUserId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { adminUser: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
