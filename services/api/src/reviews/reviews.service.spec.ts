import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { ReviewsService } from "./reviews.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ReviewsService", () => {
  let prisma: {
    booking: { findUnique: jest.Mock };
    review: { create: jest.Mock; update: jest.Mock; aggregate: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    tutorProfile: { update: jest.Mock };
  };
  let service: ReviewsService;

  const student = { id: "student-user-1" } as User;
  const tutor = { id: "tutor-user-1" } as User;
  const stranger = { id: "stranger-1" } as User;

  beforeEach(() => {
    prisma = {
      booking: { findUnique: jest.fn() },
      review: {
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      tutorProfile: { update: jest.fn() },
    };
    service = new ReviewsService(prisma as unknown as PrismaService);
  });

  describe("submit", () => {
    const booking = {
      id: "b1",
      tutorId: "tp1",
      status: "COMPLETED",
      student: { userId: student.id },
      tutor: { userId: tutor.id },
      review: null,
    };

    it("throws NotFoundException when the booking doesn't exist", async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.submit(student, "missing", { rating: 5 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when the requester isn't the booking's student", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      await expect(service.submit(stranger, "b1", { rating: 5 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("throws ForbiddenException when the tutor tries to review their own booking", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      await expect(service.submit(tutor, "b1", { rating: 5 })).rejects.toThrow(ForbiddenException);
    });

    it("throws BadRequestException when the booking isn't COMPLETED", async () => {
      prisma.booking.findUnique.mockResolvedValue({ ...booking, status: "CONFIRMED" });
      await expect(service.submit(student, "b1", { rating: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("creates a new review and recomputes the tutor's aggregate rating", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.review.create.mockResolvedValue({ id: "r1", rating: 5, text: "Bagus", flagged: false });
      prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 3 } });

      const result = await service.submit(student, "b1", { rating: 5, text: "Bagus" });

      expect(prisma.review.create).toHaveBeenCalledWith({
        data: { bookingId: "b1", rating: 5, text: "Bagus", flagged: false },
      });
      expect(prisma.review.aggregate).toHaveBeenCalledWith({
        where: { flagged: false, booking: { tutorId: "tp1" } },
        _avg: { rating: true },
        _count: { rating: true },
      });
      expect(prisma.tutorProfile.update).toHaveBeenCalledWith({
        where: { id: "tp1" },
        data: { averageRating: 4.5, reviewCount: 3 },
      });
      expect(result).toEqual({ id: "r1", rating: 5, text: "Bagus", flagged: false });
    });

    it("flags a review containing a filtered keyword but still saves it", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.review.create.mockResolvedValue({ id: "r1" });
      prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 1 }, _count: { rating: 1 } });

      await service.submit(student, "b1", { rating: 1, text: "Tutor ini goblok sekali" });

      expect(prisma.review.create).toHaveBeenCalledWith({
        data: { bookingId: "b1", rating: 1, text: "Tutor ini goblok sekali", flagged: true },
      });
    });

    it("edits an existing review within the edit window", async () => {
      const recentReview = { createdAt: new Date(Date.now() - 60 * 60 * 1000) };
      prisma.booking.findUnique.mockResolvedValue({ ...booking, review: recentReview });
      prisma.review.update.mockResolvedValue({ id: "r1", rating: 4 });
      prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4 }, _count: { rating: 1 } });

      const result = await service.submit(student, "b1", { rating: 4, text: "Diperbarui" });

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { bookingId: "b1" },
        data: { rating: 4, text: "Diperbarui", flagged: false },
      });
      expect(result).toEqual({ id: "r1", rating: 4 });
    });

    it("rejects editing a review past the edit window", async () => {
      const staleReview = { createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000) };
      prisma.booking.findUnique.mockResolvedValue({ ...booking, review: staleReview });

      await expect(service.submit(student, "b1", { rating: 1 })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.review.update).not.toHaveBeenCalled();
    });
  });

  describe("getForBooking", () => {
    const booking = {
      student: { userId: student.id },
      tutor: { userId: tutor.id },
      review: { id: "r1", rating: 5 },
    };

    it("throws NotFoundException when the booking doesn't exist", async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.getForBooking(student, "missing")).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException for a non-participant", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      await expect(service.getForBooking(stranger, "b1")).rejects.toThrow(ForbiddenException);
    });

    it("returns the review (or null) for a participant", async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      const result = await service.getForBooking(tutor, "b1");
      expect(result).toEqual({ id: "r1", rating: 5 });
    });
  });

  describe("listForTutor", () => {
    it("excludes flagged reviews and maps to the public shape", async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          id: "r1",
          rating: 5,
          text: "Mantap",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          booking: { student: { user: { name: "Andi" } } },
        },
      ]);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.listForTutor("tp1", 1, 10);

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { flagged: false, booking: { tutorId: "tp1" } } }),
      );
      expect(result.data).toEqual([
        {
          id: "r1",
          rating: 5,
          text: "Mantap",
          createdAt: "2026-08-01T00:00:00.000Z",
          studentName: "Andi",
        },
      ]);
      expect(result.total).toBe(1);
    });
  });
});
