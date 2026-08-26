import { Injectable, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { RedisService } from "../redis/redis.service";
import { CreatePackageDto } from "./dto/create-package.dto";
import { UpdatePackageDto } from "./dto/update-package.dto";

const ACTIVE_PACKAGES_CACHE_KEY = "packages:active";
const ACTIVE_PACKAGES_CACHE_TTL_SECONDS = 60 * 60;

/**
 * Admin-managed fixed-price tutoring packages (Feature: admin package
 * management) - a reusable pricing template a tutor can pick when
 * scheduling a session, overriding the normal hourlyRate x duration price.
 * Never hard-deleted (isActive toggle only), since a historical booking may
 * reference one permanently - same convention as Subject/GradeLevel.
 */
@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly redis: RedisService,
  ) {}

  adminList() {
    return this.prisma.tutoringPackage.findMany({ orderBy: { createdAt: "desc" } });
  }

  async adminCreate(admin: User, dto: CreatePackageDto) {
    const created = await this.prisma.tutoringPackage.create({
      data: {
        name: dto.name,
        sessionCount: dto.sessionCount,
        durationMinutes: dto.durationMinutes,
        totalPrice: dto.totalPrice,
      },
    });
    await this.auditLog.log(admin.id, "package.create", "TutoringPackage", created.id, { ...dto });
    await this.bustActivePackagesCache();
    return created;
  }

  async adminUpdate(admin: User, id: string, dto: UpdatePackageDto) {
    await this.requirePackage(id);
    const updated = await this.prisma.tutoringPackage.update({ where: { id }, data: dto });
    await this.auditLog.log(admin.id, "package.update", "TutoringPackage", id, { ...dto });
    await this.bustActivePackagesCache();
    return updated;
  }

  async adminSetActive(admin: User, id: string, isActive: boolean) {
    await this.requirePackage(id);
    const updated = await this.prisma.tutoringPackage.update({ where: { id }, data: { isActive } });
    await this.auditLog.log(admin.id, "package.set_active", "TutoringPackage", id, { isActive });
    await this.bustActivePackagesCache();
    return updated;
  }

  // Tutor-facing read (ScheduleSessionForm's package selector) - cached
  // since, unlike Subject/GradeLevel, packages are expected to change after
  // launch, so every admin write above explicitly busts this key rather
  // than relying on the TTL alone.
  async listActive() {
    const cached = await this.redis.get<unknown>(ACTIVE_PACKAGES_CACHE_KEY);
    if (cached) return cached;

    const packages = await this.prisma.tutoringPackage.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    await this.redis.set(ACTIVE_PACKAGES_CACHE_KEY, packages, ACTIVE_PACKAGES_CACHE_TTL_SECONDS);
    return packages;
  }

  private async bustActivePackagesCache() {
    await this.redis.del(ACTIVE_PACKAGES_CACHE_KEY);
  }

  private async requirePackage(id: string) {
    const pkg = await this.prisma.tutoringPackage.findUnique({ where: { id } });
    if (!pkg) {
      throw new NotFoundException("No package with that id exists.");
    }
    return pkg;
  }
}
