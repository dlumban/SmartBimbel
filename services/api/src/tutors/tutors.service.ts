import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TutorProfile, User } from "@prisma/client";
import {
  ACTIVE_BOOKING_STATUSES,
  distanceKm,
  getCityCoordinates,
  PaginatedTutorList,
  TutorDetail,
  TutorListItem,
} from "@smartbimbel/shared";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { RedisService } from "../redis/redis.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { UpsertTutorProfileDto } from "./dto/upsert-tutor-profile.dto";
import { VerifyTutorDto } from "./dto/verify-tutor.dto";
import { SearchTutorsDto } from "./dto/search-tutors.dto";

const PROFILE_INCLUDE = { subjects: true, gradeLevels: true } as const;
const DEFAULT_QUERY_CACHE_KEY = "tutors:default-query:page1";
// Short TTL - unlike subjects/grade-levels this reflects tutor verification
// and rate changes, which happen far more often than master data does.
const DEFAULT_QUERY_CACHE_TTL_SECONDS = 60;
const PUBLIC_INCLUDE = { subjects: true, gradeLevels: true, user: true } as const;

type PublicTutorProfile = TutorProfile & {
  subjects: { id: string; name: string }[];
  gradeLevels: { id: string; name: string }[];
  user: { name: string | null };
};

function toListItem(t: PublicTutorProfile): TutorListItem {
  return {
    id: t.id,
    name: t.user.name,
    photoUrl: t.photoUrl,
    bio: t.bio,
    subjects: t.subjects.map((s) => s.name),
    gradeLevels: t.gradeLevels.map((g) => g.name),
    hourlyRate: t.hourlyRate,
    // Recomputed on every non-flagged Review write (Task 6.5) - see
    // ReviewsService.recomputeTutorRating.
    rating: t.averageRating,
    reviewCount: t.reviewCount,
    city: t.city,
    teachingModes: t.teachingModes,
  };
}

export type DocumentType = "ktp" | "diploma";

@Injectable()
export class TutorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Upsert rather than separate create/update - the multi-step onboarding
   * form (Task 1.5) calls this after every step so progress is never lost
   * if the tutor closes the app mid-flow, without the frontend needing to
   * track whether the row already exists.
   */
  async upsertProfile(user: User, dto: UpsertTutorProfileDto) {
    await this.assertReferencesExist(dto);

    const existing = await this.prisma.tutorProfile.findUnique({
      where: { userId: user.id },
    });

    const relationData = {
      ...(dto.subjectIds ? { subjects: { set: dto.subjectIds.map((id) => ({ id })) } } : {}),
      ...(dto.gradeLevelIds
        ? { gradeLevels: { set: dto.gradeLevelIds.map((id) => ({ id })) } }
        : {}),
    };

    if (!existing) {
      return this.prisma.tutorProfile.create({
        data: {
          userId: user.id,
          bio: dto.bio,
          education: dto.education,
          hourlyRate: dto.hourlyRate,
          teachingModes: dto.teachingModes ?? [],
          city: dto.city,
          subjects: dto.subjectIds ? { connect: dto.subjectIds.map((id) => ({ id })) } : undefined,
          gradeLevels: dto.gradeLevelIds
            ? { connect: dto.gradeLevelIds.map((id) => ({ id })) }
            : undefined,
        },
        include: PROFILE_INCLUDE,
      });
    }

    return this.prisma.tutorProfile.update({
      where: { userId: user.id },
      data: {
        bio: dto.bio,
        education: dto.education,
        hourlyRate: dto.hourlyRate,
        teachingModes: dto.teachingModes,
        city: dto.city,
        ...relationData,
      },
      include: PROFILE_INCLUDE,
    });
  }

  async getMyProfile(user: User) {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { userId: user.id },
      include: PROFILE_INCLUDE,
    });
    if (!profile) {
      throw new NotFoundException("No tutor profile exists for this account yet.");
    }
    return profile;
  }

  async uploadDocument(user: User, type: DocumentType, file: Express.Multer.File) {
    const profile = await this.requireProfile(user);
    const ext = (file.originalname.split(".").pop() ?? "bin").toLowerCase();
    const relativePath = await this.storage.save(
      `tutor-documents/${user.id}`,
      `${type}.${ext}`,
      file.buffer,
    );

    return this.prisma.tutorProfile.update({
      where: { id: profile.id },
      data:
        type === "ktp"
          ? { ktpDocumentPath: relativePath }
          : { diplomaDocumentPath: relativePath },
    });
  }

  async getDocument(user: User, type: DocumentType): Promise<Buffer> {
    const profile = await this.requireProfile(user);
    return this.readDocument(profile, type);
  }

  // Admin document review (Task 7.2's AC: "review... documents without
  // leaving the panel") - served through this authenticated route rather
  // than a public URL, same "never a public link" rule the tutor's own
  // self-service download already follows.
  async getDocumentForReview(tutorProfileId: string, type: DocumentType): Promise<Buffer> {
    const profile = await this.prisma.tutorProfile.findUnique({ where: { id: tutorProfileId } });
    if (!profile) {
      throw new NotFoundException("No tutor profile with that id exists.");
    }
    return this.readDocument(profile, type);
  }

  private async readDocument(
    profile: { ktpDocumentPath: string | null; diplomaDocumentPath: string | null },
    type: DocumentType,
  ): Promise<Buffer> {
    const relativePath = type === "ktp" ? profile.ktpDocumentPath : profile.diplomaDocumentPath;
    if (!relativePath) {
      throw new NotFoundException(`No ${type} document has been uploaded yet.`);
    }
    return this.storage.read(relativePath);
  }

  /**
   * Validates the profile is actually complete before flipping it into the
   * admin review queue - profileSubmittedAt (not verificationStatus, which
   * defaults to PENDING from row creation) is what Task 1.6's queue filters
   * on.
   */
  async submitForReview(user: User) {
    const profile = await this.requireProfile(user);

    const missing: string[] = [];
    if (!profile.bio) missing.push("bio");
    if (!profile.education) missing.push("education");
    if (!profile.hourlyRate || profile.hourlyRate <= 0) missing.push("hourlyRate");
    if (!profile.city) missing.push("city");
    if (profile.teachingModes.length === 0) missing.push("teachingModes");
    if (profile.subjects.length === 0) missing.push("subjects");
    if (profile.gradeLevels.length === 0) missing.push("gradeLevels");
    if (!profile.ktpDocumentPath) missing.push("ktpDocument");

    if (missing.length > 0) {
      throw new BadRequestException(
        `Profile is incomplete, missing: ${missing.join(", ")}`,
      );
    }

    return this.prisma.tutorProfile.update({
      where: { id: profile.id },
      // Resubmitting after a REJECTED verdict resets to PENDING and clears
      // the old reason - otherwise a corrected, resubmitted profile would
      // never reappear in listPendingReview()'s queue (it filters on
      // verificationStatus: "PENDING").
      data: {
        profileSubmittedAt: new Date(),
        verificationStatus: "PENDING",
        rejectionReason: null,
      },
      include: PROFILE_INCLUDE,
    });
  }

  /** Admin review queue - only profiles the tutor has actually submitted. */
  async listPendingReview() {
    return this.prisma.tutorProfile.findMany({
      where: { profileSubmittedAt: { not: null }, verificationStatus: "PENDING" },
      include: { ...PROFILE_INCLUDE, user: true },
      orderBy: { profileSubmittedAt: "asc" },
    });
  }

  async verify(admin: User, tutorProfileId: string, dto: VerifyTutorDto) {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { id: tutorProfileId },
    });
    if (!profile) {
      throw new NotFoundException("No tutor profile with that id exists.");
    }
    if (!profile.profileSubmittedAt) {
      throw new BadRequestException(
        "This profile hasn't been submitted for review yet.",
      );
    }

    const updated = await this.prisma.tutorProfile.update({
      where: { id: tutorProfileId },
      data: {
        verificationStatus: dto.status,
        rejectionReason: dto.status === "REJECTED" ? dto.reason : null,
      },
      include: PROFILE_INCLUDE,
    });

    await this.auditLog.log(admin.id, "tutor.verify", "TutorProfile", tutorProfileId, {
      status: dto.status,
      reason: dto.reason,
    });

    return updated;
  }

  /**
   * Public tutor search/browse - Tasks 2.2 (listing) and 2.3 (filters)
   * built as one endpoint from the start per Task 2.2's own guidance,
   * rather than bolting filters on after.
   */
  async search(query: SearchTutorsDto): Promise<PaginatedTutorList> {
    if (query.priceMin != null && query.priceMax != null && query.priceMin > query.priceMax) {
      throw new BadRequestException("priceMin cannot be greater than priceMax.");
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const isDefaultQuery =
      page === 1 &&
      limit === 20 &&
      !query.city &&
      !query.subjectId &&
      !query.gradeLevelId &&
      !query.mode &&
      query.priceMin == null &&
      query.priceMax == null &&
      !query.q &&
      !query.sort;

    if (isDefaultQuery) {
      const cached = await this.redis.get<PaginatedTutorList>(DEFAULT_QUERY_CACHE_KEY);
      if (cached) return cached;
    }

    const where: Prisma.TutorProfileWhereInput = {
      verificationStatus: "VERIFIED",
      ...(query.city && { city: { equals: query.city, mode: "insensitive" } }),
      ...(query.subjectId && { subjects: { some: { id: query.subjectId } } }),
      ...(query.gradeLevelId && { gradeLevels: { some: { id: query.gradeLevelId } } }),
      ...(query.mode && { teachingModes: { has: query.mode } }),
      ...((query.priceMin != null || query.priceMax != null) && {
        hourlyRate: {
          ...(query.priceMin != null && { gte: query.priceMin }),
          ...(query.priceMax != null && { lte: query.priceMax }),
        },
      }),
      ...(query.q && {
        OR: [
          { bio: { contains: query.q, mode: "insensitive" } },
          { user: { name: { contains: query.q, mode: "insensitive" } } },
        ],
      }),
    };

    if (query.sort === "nearest") {
      return this.searchNearest(where, query, page, limit);
    }

    // Explicit nulls:"last" (Task 6.5) - Postgres's own default for DESC is
    // NULLS FIRST, which would otherwise put every never-reviewed tutor
    // ahead of a genuinely well-rated one on a "highest rated first" sort.
    const orderBy: Prisma.TutorProfileOrderByWithRelationInput =
      query.sort === "price"
        ? { hourlyRate: "asc" }
        : query.sort === "rating"
          ? { averageRating: { sort: "desc", nulls: "last" } }
          : { createdAt: "desc" };

    const [total, results] = await Promise.all([
      this.prisma.tutorProfile.count({ where }),
      this.prisma.tutorProfile.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: PUBLIC_INCLUDE,
      }),
    ]);

    const result = { data: results.map(toListItem), page, limit, total };

    if (isDefaultQuery) {
      await this.redis.set(DEFAULT_QUERY_CACHE_KEY, result, DEFAULT_QUERY_CACHE_TTL_SECONDS);
    }

    return result;
  }

  private async searchNearest(
    where: Prisma.TutorProfileWhereInput,
    query: SearchTutorsDto,
    page: number,
    limit: number,
  ): Promise<PaginatedTutorList> {
    if (!query.near) {
      throw new BadRequestException("sort=nearest requires a 'near' city.");
    }
    const origin = getCityCoordinates(query.near);
    if (!origin) {
      throw new BadRequestException(`Unsupported city for 'near': ${query.near}`);
    }

    // Distance can't be computed in SQL against the static city table, so
    // this sort mode fetches candidates and sorts in application code -
    // fine at MVP tutor volumes, revisit if the candidate set grows large.
    const all = await this.prisma.tutorProfile.findMany({ where, include: PUBLIC_INCLUDE });
    const withDistance = all
      .map((t) => {
        const coords = t.city ? getCityCoordinates(t.city) : null;
        return coords ? { item: toListItem(t), km: distanceKm(origin, coords) } : null;
      })
      .filter((x): x is { item: TutorListItem; km: number } => x !== null)
      .sort((a, b) => a.km - b.km);

    const paged = withDistance.slice((page - 1) * limit, (page - 1) * limit + limit);
    return {
      data: paged.map(({ item, km }) => ({ ...item, distanceKm: Math.round(km * 10) / 10 })),
      page,
      limit,
      total: withDistance.length,
    };
  }

  async getPublicDetail(id: string): Promise<TutorDetail> {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { id },
      include: PUBLIC_INCLUDE,
    });
    if (!profile || profile.verificationStatus !== "VERIFIED") {
      // Same 404 whether the id doesn't exist or the tutor isn't verified -
      // don't leak which unverified tutor ids exist.
      throw new NotFoundException("No tutor profile with that id exists.");
    }
    return {
      ...toListItem(profile),
      education: profile.education,
      subjectOptions: profile.subjects.map((s) => ({ id: s.id, name: s.name })),
    };
  }

  // Public (no auth) - a prospective student needs this to render a
  // busy/free calendar before booking. Deliberately minimal: no student
  // identity, just enough to know which half-hours are taken. No date
  // bound, same "fetch it all" pragmatism as elsewhere at this scale.
  async getSchedule(id: string): Promise<{ scheduledAt: string; durationMinutes: number }[]> {
    const profile = await this.prisma.tutorProfile.findUnique({ where: { id } });
    if (!profile || profile.verificationStatus !== "VERIFIED") {
      throw new NotFoundException("No tutor profile with that id exists.");
    }
    const bookings = await this.prisma.booking.findMany({
      where: { tutorId: id, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
      select: { scheduledAt: true, durationMinutes: true },
    });
    const now = Date.now();
    return bookings
      .filter((b) => b.scheduledAt.getTime() + b.durationMinutes * 60 * 1000 > now)
      .map((b) => ({ scheduledAt: b.scheduledAt.toISOString(), durationMinutes: b.durationMinutes }));
  }

  private async requireProfile(user: User) {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { userId: user.id },
      include: PROFILE_INCLUDE,
    });
    if (!profile) {
      throw new NotFoundException("No tutor profile exists for this account yet.");
    }
    return profile;
  }

  private async assertReferencesExist(dto: UpsertTutorProfileDto) {
    if (dto.subjectIds) {
      const found = await this.prisma.subject.findMany({
        where: { id: { in: dto.subjectIds } },
      });
      if (found.length !== dto.subjectIds.length) {
        throw new BadRequestException("One or more subjectIds are unknown.");
      }
    }
    if (dto.gradeLevelIds) {
      const found = await this.prisma.gradeLevel.findMany({
        where: { id: { in: dto.gradeLevelIds } },
      });
      if (found.length !== dto.gradeLevelIds.length) {
        throw new BadRequestException("One or more gradeLevelIds are unknown.");
      }
    }
  }
}
