import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

const CACHE_TTL_SECONDS = 60 * 60; // near-static data - see Task 2.1

/**
 * Minimal public read endpoints, pulled forward from Sprint 2 (Task 2.1)
 * because Sprint 1's profile forms (student + tutor) can't function without
 * a subject/grade-level list to select from. Sprint 2 adds caching and any
 * additional filtering on top of this - the shape here is deliberately the
 * bare minimum, not a guess at that sprint's fuller scope.
 */
@Controller()
export class MasterDataController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get("subjects")
  async subjects() {
    const cached = await this.redis.get("master-data:subjects");
    if (cached) return cached;

    const subjects = await this.prisma.subject.findMany({ orderBy: { name: "asc" } });
    await this.redis.set("master-data:subjects", subjects, CACHE_TTL_SECONDS);
    return subjects;
  }

  @Get("grade-levels")
  async gradeLevels() {
    const cached = await this.redis.get("master-data:grade-levels");
    if (cached) return cached;

    const gradeLevels = await this.prisma.gradeLevel.findMany({ orderBy: { name: "asc" } });
    await this.redis.set("master-data:grade-levels", gradeLevels, CACHE_TTL_SECONDS);
    return gradeLevels;
  }
}
