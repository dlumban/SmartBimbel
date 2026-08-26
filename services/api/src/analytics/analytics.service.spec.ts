import { AnalyticsService } from "./analytics.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AnalyticsService", () => {
  let prisma: {
    user: { count: jest.Mock };
    booking: { count: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock };
    transaction: { aggregate: jest.Mock };
    review: { aggregate: jest.Mock };
    tutorProfile: { count: jest.Mock };
  };
  let service: AnalyticsService;

  beforeEach(() => {
    prisma = {
      user: { count: jest.fn() },
      booking: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      transaction: { aggregate: jest.fn() },
      review: { aggregate: jest.fn() },
      tutorProfile: { count: jest.fn() },
    };
    service = new AnalyticsService(prisma as unknown as PrismaService);
  });

  describe("summary", () => {
    function stub(overrides: Partial<{
      registeredTutors: number;
      registeredStudents: number;
      completedBookings: number;
      totalBookings: number;
      confirmedOrLater: number;
      gmv: number;
      commission: number;
      avgRating: number | null;
      ratingCount: number;
      verifiedTutors: number;
      tutorsWithCompleted: string[];
      studentsWithAny: string[];
      studentsWithSecond: { studentId: string }[];
    }> = {}) {
      const v = {
        registeredTutors: 10,
        registeredStudents: 20,
        completedBookings: 5,
        totalBookings: 8,
        confirmedOrLater: 6,
        gmv: 1000000,
        commission: 150000,
        avgRating: 4.5,
        ratingCount: 5,
        verifiedTutors: 8,
        tutorsWithCompleted: ["tp1", "tp2"],
        studentsWithAny: ["sp1", "sp2", "sp3", "sp4"],
        studentsWithSecond: [{ studentId: "sp1" }],
        ...overrides,
      };
      prisma.user.count.mockResolvedValueOnce(v.registeredTutors).mockResolvedValueOnce(v.registeredStudents);
      prisma.booking.count
        .mockResolvedValueOnce(v.completedBookings)
        .mockResolvedValueOnce(v.totalBookings)
        .mockResolvedValueOnce(v.confirmedOrLater);
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: v.gmv, commission: v.commission },
      });
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: v.avgRating },
        _count: { rating: v.ratingCount },
      });
      prisma.tutorProfile.count.mockResolvedValue(v.verifiedTutors);
      prisma.booking.findMany
        .mockResolvedValueOnce(v.tutorsWithCompleted.map((tutorId) => ({ tutorId })))
        .mockResolvedValueOnce(v.studentsWithAny.map((studentId) => ({ studentId })));
      prisma.booking.groupBy.mockResolvedValue(v.studentsWithSecond);
    }

    it("computes every metric from the underlying aggregates", async () => {
      stub();

      const result = await service.summary({});

      expect(result.registeredTutors).toBe(10);
      expect(result.registeredStudents).toBe(20);
      expect(result.completedBookings).toBe(5);
      expect(result.bookingConversionRate).toBeCloseTo(6 / 8);
      expect(result.gmv).toBe(1000000);
      expect(result.platformTake).toBe(150000);
      expect(result.averageSessionRating).toBe(4.5);
      expect(result.ratingCount).toBe(5);
      expect(result.tutorActivationRate).toBeCloseTo(2 / 8);
      expect(result.studentSecondBookingRate).toBeCloseTo(1 / 4);
    });

    it("returns zero rates rather than dividing by zero when there's no data", async () => {
      stub({ totalBookings: 0, confirmedOrLater: 0, verifiedTutors: 0, studentsWithAny: [] });

      const result = await service.summary({});

      expect(result.bookingConversionRate).toBe(0);
      expect(result.tutorActivationRate).toBe(0);
      expect(result.studentSecondBookingRate).toBe(0);
    });

    it("applies the date range to the relevant queries", async () => {
      stub();

      await service.summary({ from: "2026-08-01", to: "2026-08-10" });

      expect(prisma.user.count).toHaveBeenNthCalledWith(1, {
        where: { role: "TUTOR", createdAt: { gte: new Date("2026-08-01"), lte: new Date("2026-08-10") } },
      });
    });
  });

  describe("cityBreakdown", () => {
    it("groups bookings and GMV by tutor city", async () => {
      prisma.booking.findMany.mockResolvedValue([
        {
          tutor: { city: "Jakarta" },
          status: "COMPLETED",
          transaction: { status: "PAID", amount: 100000, commission: 15000, paidAt: new Date() },
        },
        {
          tutor: { city: "Jakarta" },
          status: "REQUESTED",
          transaction: null,
        },
        {
          tutor: { city: "Bandung" },
          status: "COMPLETED",
          transaction: { status: "PAID", amount: 200000, commission: 30000, paidAt: new Date() },
        },
      ]);

      const result = await service.cityBreakdown({});

      expect(result).toEqual([
        { city: "Bandung", bookingCount: 1, gmv: 200000, platformTake: 30000 },
        { city: "Jakarta", bookingCount: 2, gmv: 100000, platformTake: 15000 },
      ]);
    });

    it("attributes an unset tutor city to a fallback bucket", async () => {
      prisma.booking.findMany.mockResolvedValue([
        { tutor: { city: null }, status: "REQUESTED", transaction: null },
      ]);

      const result = await service.cityBreakdown({});

      expect(result).toEqual([{ city: "Tidak diketahui", bookingCount: 1, gmv: 0, platformTake: 0 }]);
    });
  });
});
