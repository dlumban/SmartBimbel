import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { REVIEW_EDIT_WINDOW_HOURS } from "@smartbimbel/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SubmitReviewDto } from "./dto/submit-review.dto";

// Simple keyword-filter first pass (Task 6.4's own scope: "basic
// profanity/abuse filter... as a first pass" - full moderation UI is
// Sprint 7). Deliberately short and unsophisticated - false negatives are
// fine (a human admin still reviews flagged content), false positives are
// the thing to avoid over-triggering, so this only catches blatant cases.
const FLAGGED_KEYWORDS = [
  "anjing",
  "bangsat",
  "bajingan",
  "kontol",
  "memek",
  "goblok",
  "tolol",
  "fuck",
  "asshole",
  "bitch",
  "bastard",
];

function containsFlaggedKeyword(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return FLAGGED_KEYWORDS.some((word) => lower.includes(word));
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // One-directional (student -> tutor) per PRD §6.1.G's phrasing and the
  // task's own confirmed reading - a tutor never reviews a student.
  // Upserts rather than separate create/update endpoints: the same
  // POST .../review both creates the first review and edits it within the
  // window, matching Task 6.4's "editable within a short window, then
  // locked" flow without a second endpoint.
  async submit(user: User, bookingId: string, dto: SubmitReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { student: true, tutor: true, review: true },
    });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    if (booking.student.userId !== user.id) {
      throw new ForbiddenException("Only the student who booked this session can review it.");
    }
    if (booking.status !== "COMPLETED") {
      throw new BadRequestException("A booking must be completed before it can be reviewed.");
    }

    const flagged = containsFlaggedKeyword(dto.text);

    if (!booking.review) {
      const review = await this.prisma.review.create({
        data: { bookingId, rating: dto.rating, text: dto.text, flagged },
      });
      await this.recomputeTutorRating(booking.tutorId);
      return review;
    }

    const ageHours = (Date.now() - booking.review.createdAt.getTime()) / (60 * 60 * 1000);
    if (ageHours > REVIEW_EDIT_WINDOW_HOURS) {
      throw new BadRequestException(
        `This review is locked - it can only be edited within ${REVIEW_EDIT_WINDOW_HOURS} hours of submission.`,
      );
    }

    const review = await this.prisma.review.update({
      where: { bookingId },
      data: { rating: dto.rating, text: dto.text, flagged },
    });
    await this.recomputeTutorRating(booking.tutorId);
    return review;
  }

  async getForBooking(user: User, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { student: true, tutor: true, review: true },
    });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    if (booking.student.userId !== user.id && booking.tutor.userId !== user.id) {
      throw new ForbiddenException("You are not a participant in this booking.");
    }
    return booking.review;
  }

  async listForTutor(tutorId: string, page = 1, limit = 10) {
    const where = { flagged: false, booking: { tutorId } };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: { booking: { include: { student: { include: { user: true } } } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    const data = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
      studentName: r.booking.student.user.name,
    }));
    return { data, total, page, limit };
  }

  // Recalculated on write (Task 6.5's own note: fine at MVP write volume).
  // Excludes flagged reviews from the public average until an admin clears
  // them (Sprint 7's moderation tooling), per the task's explicit AC.
  private async recomputeTutorRating(tutorId: string): Promise<void> {
    const agg = await this.prisma.review.aggregate({
      where: { flagged: false, booking: { tutorId } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await this.prisma.tutorProfile.update({
      where: { id: tutorId },
      data: {
        averageRating: agg._avg.rating,
        reviewCount: agg._count.rating,
      },
    });
  }
}
