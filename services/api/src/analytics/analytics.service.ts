import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";

interface DateRange {
  gte?: Date;
  lte?: Date;
}

/**
 * Every metric named in PRD §3's success-metrics table (Task 7.6) -
 * purpose-built aggregation over our own DB, not a general BI tool. Every
 * count below is scoped to the requested date range via whichever
 * timestamp best represents "when this metric's event happened"
 * (registration date, completion date, payment date, etc.) - documented
 * per metric since PRD doesn't pin an exact field, and getting this
 * consistent is what makes "date-range filtering correctly recomputes all
 * widgets" (the task's own AC) actually true rather than only partially
 * true.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(query: AnalyticsQueryDto): DateRange {
    const range: DateRange = {};
    if (query.from) range.gte = new Date(query.from);
    if (query.to) range.lte = new Date(query.to);
    return range;
  }

  async summary(query: AnalyticsQueryDto) {
    const range = this.range(query);
    const hasRange = range.gte !== undefined || range.lte !== undefined;
    const dateFilter = hasRange ? range : undefined;

    const [
      registeredTutors,
      registeredStudents,
      completedBookings,
      totalBookingsInRange,
      confirmedOrLaterInRange,
      paidTransactions,
      ratingAgg,
      verifiedTutorCount,
      tutorsWithCompletedBooking,
      studentsWithAnyBookingInRange,
      studentsWithSecondBookingInRange,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: "TUTOR", ...(dateFilter && { createdAt: dateFilter }) } }),
      this.prisma.user.count({ where: { role: "STUDENT", ...(dateFilter && { createdAt: dateFilter }) } }),
      this.prisma.booking.count({
        where: { status: "COMPLETED", ...(dateFilter && { completedAt: dateFilter }) },
      }),
      this.prisma.booking.count({ where: { ...(dateFilter && { createdAt: dateFilter }) } }),
      this.prisma.booking.count({
        where: {
          status: { in: ["CONFIRMED", "COMPLETED"] },
          ...(dateFilter && { createdAt: dateFilter }),
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: { in: ["PAID", "REFUNDED"] },
          paidAt: { not: null, ...dateFilter },
        },
        _sum: { amount: true, commission: true },
      }),
      this.prisma.review.aggregate({
        where: { flagged: false, ...(dateFilter && { createdAt: dateFilter }) },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.tutorProfile.count({ where: { verificationStatus: "VERIFIED" } }),
      this.prisma.booking.findMany({
        where: { status: "COMPLETED", ...(dateFilter && { completedAt: dateFilter }) },
        select: { tutorId: true },
        distinct: ["tutorId"],
      }),
      this.prisma.booking.findMany({
        where: { ...(dateFilter && { createdAt: dateFilter }) },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      this.countStudentsWithSecondBooking(dateFilter),
    ]);

    const gmv = paidTransactions._sum.amount ?? 0;
    const platformTake = paidTransactions._sum.commission ?? 0;
    const studentsWithAnyBooking = studentsWithAnyBookingInRange.length;

    return {
      registeredTutors,
      registeredStudents,
      completedBookings,
      bookingConversionRate:
        totalBookingsInRange === 0 ? 0 : confirmedOrLaterInRange / totalBookingsInRange,
      gmv,
      platformTake,
      averageSessionRating: ratingAgg._avg.rating,
      ratingCount: ratingAgg._count.rating,
      // "Tutors with >=1 completed booking (in range) / all currently
      // verified tutors" - the denominator is a snapshot rather than
      // range-scoped, since "% of today's verified tutor pool that has
      // ever activated" is the actionable number; scoping the denominator
      // to the range too would make an early, short range look
      // artificially healthy.
      tutorActivationRate:
        verifiedTutorCount === 0 ? 0 : tutorsWithCompletedBooking.length / verifiedTutorCount,
      studentSecondBookingRate:
        studentsWithAnyBooking === 0 ? 0 : studentsWithSecondBookingInRange / studentsWithAnyBooking,
    };
  }

  private async countStudentsWithSecondBooking(dateFilter?: DateRange): Promise<number> {
    const grouped = await this.prisma.booking.groupBy({
      by: ["studentId"],
      where: { ...(dateFilter && { createdAt: dateFilter }) },
      _count: { id: true },
      having: { id: { _count: { gte: 2 } } },
    });
    return grouped.length;
  }

  async cityBreakdown(query: AnalyticsQueryDto) {
    const range = this.range(query);
    const hasRange = range.gte !== undefined || range.lte !== undefined;
    const dateFilter = hasRange ? range : undefined;

    const bookings = await this.prisma.booking.findMany({
      where: { ...(dateFilter && { createdAt: dateFilter }) },
      select: {
        tutor: { select: { city: true } },
        status: true,
        transaction: { select: { status: true, amount: true, commission: true, paidAt: true } },
      },
    });

    const byCity = new Map<string, { bookingCount: number; gmv: number; platformTake: number }>();
    for (const booking of bookings) {
      const city = booking.tutor.city ?? "Tidak diketahui";
      const entry = byCity.get(city) ?? { bookingCount: 0, gmv: 0, platformTake: 0 };
      entry.bookingCount += 1;
      if (
        booking.transaction &&
        (booking.transaction.status === "PAID" || booking.transaction.status === "REFUNDED") &&
        booking.transaction.paidAt &&
        (!dateFilter ||
          ((!range.gte || booking.transaction.paidAt >= range.gte) &&
            (!range.lte || booking.transaction.paidAt <= range.lte)))
      ) {
        entry.gmv += booking.transaction.amount;
        entry.platformTake += booking.transaction.commission;
      }
      byCity.set(city, entry);
    }

    return Array.from(byCity.entries())
      .map(([city, stats]) => ({ city, ...stats }))
      .sort((a, b) => b.gmv - a.gmv);
  }
}
