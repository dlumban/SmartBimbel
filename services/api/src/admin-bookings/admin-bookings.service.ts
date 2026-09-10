import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SearchAdminBookingsDto } from "./dto/search-admin-bookings.dto";
import { OverrideCancelBookingDto } from "./dto/override-cancel-booking.dto";

const BOOKING_INCLUDE = {
  student: { include: { user: true } },
  tutor: { include: { user: true } },
  subject: true,
  transaction: true,
  review: true,
} as const;

// A booking already at rest never needs (or accepts) a forced cancel -
// distinct from the participant-facing state machine (Task 3.3), since
// this is a platform-wide safety valve, not a normal transition.
const TERMINAL_STATUSES = ["DECLINED", "EXPIRED", "CANCELLED", "COMPLETED"] as const;

@Injectable()
export class AdminBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async search(query: SearchAdminBookingsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.city ? { tutor: { city: { equals: query.city, mode: "insensitive" } } } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...((query.from || query.to) && {
        scheduledAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
      }),
      ...(query.q && {
        OR: [
          { student: { user: { name: { contains: query.q, mode: "insensitive" } } } },
          { tutor: { user: { name: { contains: query.q, mode: "insensitive" } } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { scheduledAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // Unlike BookingsService.findOne (Task 3.4), this never checks
  // participant membership - admin support staff need to look up any
  // booking on the platform to help with a case.
  async detail(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { ...BOOKING_INCLUDE, statusHistory: { orderBy: { createdAt: "asc" } } },
    });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    return booking;
  }

  // Super-Admin-only (enforced at the controller) - force-cancels a
  // booking outside the normal participant-driven state machine, for
  // edge cases support staff can't resolve any other way (Task 7.3's own
  // scope: "e.g. force-cancel in an edge case"). Never charges a
  // late-cancellation fee (that concept only makes sense for a
  // participant-initiated cancel) and never auto-refunds a paid
  // transaction - a paid CONFIRMED booking still needs the dispute flow
  // (Task 5.6) for any refund, this only stops the session from
  // proceeding.
  async overrideCancel(admin: User, id: string, dto: OverrideCancelBookingDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    if ((TERMINAL_STATUSES as readonly string[]).includes(booking.status)) {
      throw new BadRequestException(`Cannot override-cancel a booking already in ${booking.status} state.`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: "CANCELLED",
          changedByUserId: admin.id,
          reason: `[Admin override] ${dto.reason}`,
        },
      });

      return tx.booking.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledByUserId: admin.id,
          cancellationReasonCode: "OTHER",
          cancellationReason: dto.reason,
          isLateCancellation: false,
          proposedScheduledAt: null,
          rescheduleProposedByUserId: null,
        },
        include: BOOKING_INCLUDE,
      });
    });

    await this.notifications.send(booking.student.userId, "BOOKING_CANCELLED", {
      bookingId: id,
      isLateCancellation: false,
    });
    await this.notifications.send(booking.tutor.userId, "BOOKING_CANCELLED", {
      bookingId: id,
      isLateCancellation: false,
    });
    await this.auditLog.log(admin.id, "booking.override_cancel", "Booking", id, {
      reason: dto.reason,
      fromStatus: booking.status,
    });

    return result;
  }
}
