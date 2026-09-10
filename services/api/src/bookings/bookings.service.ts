import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { randomBytes } from "crypto";
import {
  Booking,
  BookingAttachment,
  BookingAttachmentKind,
  NotificationType,
  Prisma,
  StudentProfile,
  TutorProfile,
  User,
} from "@prisma/client";
import {
  ACTIVE_BOOKING_STATUSES,
  BookingListBucket,
  CANCELLED_LIKE_BOOKING_STATUSES,
  combineLocalDateTimeToUtc,
  FREE_CANCELLATION_WINDOW_HOURS,
  getTimezoneForCity,
  isValidMeetingLink,
} from "@smartbimbel/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ChatService } from "../chat/chat.service";
import { PaymentsService } from "../payments/payments.service";
import { StorageService } from "../storage/storage.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { DeclineBookingDto } from "./dto/decline-booking.dto";
import { CounterProposeBookingDto } from "./dto/counter-propose-booking.dto";
import { ProposeRescheduleDto } from "./dto/propose-reschedule.dto";
import { CancelBookingDto } from "./dto/cancel-booking.dto";
import { UpdateBookingDto } from "./dto/update-booking.dto";
import { SetMeetingDto } from "./dto/set-meeting.dto";
import { AddSessionNotesDto } from "./dto/add-session-notes.dto";
import { ListBookingsDto } from "./dto/list-bookings.dto";
import { BOOKING_EXPIRY_QUEUE, SESSION_REMINDER_QUEUE } from "../jobs/jobs.module";
import { BookingActor, BookingResponseAction, resolveBookingTransition } from "./booking-state-machine";
import { SessionReminderJobData } from "./processors/session-reminder.processor";

export const RESPONSE_WINDOW_HOURS = 24;

const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

const BOOKING_INCLUDE = {
  student: { include: { user: true } },
  tutor: { include: { user: true } },
  subject: true,
} as const;

type BookingWithParticipants = { student: { userId: string }; tutor: { userId: string } };
type BookingWithInclude = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly chat: ChatService,
    private readonly payments: PaymentsService,
    private readonly storage: StorageService,
    @InjectQueue(BOOKING_EXPIRY_QUEUE) private readonly expiryQueue: Queue,
    @InjectQueue(SESSION_REMINDER_QUEUE) private readonly reminderQueue: Queue,
  ) {}

  // Schedules the 24h-before and 1h-before reminders (Task 3.6) against
  // whatever scheduledAt was just confirmed - called once a booking
  // actually lands on ACCEPTED, whether that's the first acceptance or an
  // accepted reschedule. Reminders whose delay would already be negative
  // (session sooner than the reminder window) are simply skipped.
  private async scheduleSessionReminders(bookingId: string, scheduledAt: Date): Promise<void> {
    const expectedScheduledAt = scheduledAt.toISOString();
    const reminders: { reminderType: SessionReminderJobData["reminderType"]; hoursBefore: number }[] = [
      { reminderType: "24H", hoursBefore: 24 },
      { reminderType: "1H", hoursBefore: 1 },
    ];

    for (const { reminderType, hoursBefore } of reminders) {
      const delay = scheduledAt.getTime() - hoursBefore * 60 * 60 * 1000 - Date.now();
      if (delay <= 0) continue;
      await this.reminderQueue.add(
        "session-reminder",
        { bookingId, reminderType, expectedScheduledAt } satisfies SessionReminderJobData,
        { delay },
      );
    }
  }

  // A STUDENT supplies dto.tutorId to pick who they're booking, resolved
  // against their own studentProfile; a TUTOR (scheduling a session
  // directly, per the tutor-initiated booking feature) supplies
  // dto.studentId instead, resolved against their own tutorProfile. Every
  // other validation/creation step below is identical either way.
  async create(user: User, dto: CreateBookingDto): Promise<Booking> {
    let studentProfile: StudentProfile;
    let tutorProfile: TutorProfile;

    if (user.role === "TUTOR") {
      const ownTutorProfile = await this.prisma.tutorProfile.findUnique({
        where: { userId: user.id },
      });
      if (!ownTutorProfile) {
        throw new NotFoundException("No tutor profile exists for this account yet.");
      }
      tutorProfile = ownTutorProfile;

      if (!dto.studentId) {
        throw new BadRequestException("studentId is required when a tutor creates a booking.");
      }
      const targetStudentProfile = await this.prisma.studentProfile.findUnique({
        where: { id: dto.studentId },
      });
      if (!targetStudentProfile) {
        throw new NotFoundException("No student with that id exists.");
      }
      studentProfile = targetStudentProfile;
    } else {
      const ownStudentProfile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
      });
      if (!ownStudentProfile) {
        throw new NotFoundException("No student profile exists for this account yet.");
      }
      studentProfile = ownStudentProfile;

      if (!dto.tutorId) {
        throw new BadRequestException("tutorId is required when a student creates a booking.");
      }
      const targetTutorProfile = await this.prisma.tutorProfile.findUnique({
        where: { id: dto.tutorId },
      });
      if (!targetTutorProfile || targetTutorProfile.verificationStatus !== "VERIFIED") {
        throw new NotFoundException("No verified tutor with that id exists.");
      }
      tutorProfile = targetTutorProfile;
    }

    if (!tutorProfile.teachingModes.includes(dto.mode)) {
      throw new BadRequestException(
        `This tutor does not offer ${dto.mode.toLowerCase()} sessions.`,
      );
    }

    let priceAmount: number;
    if (dto.packageId) {
      const pkg = await this.prisma.tutoringPackage.findUnique({ where: { id: dto.packageId } });
      if (!pkg || !pkg.isActive) {
        throw new BadRequestException("Unknown or inactive packageId.");
      }
      // The frontend always sends the matching value once a package is
      // selected - this only guards direct API misuse, not a normal user
      // path.
      if (dto.durationMinutes !== pkg.durationMinutes) {
        throw new BadRequestException(
          `This package's sessions are fixed at ${pkg.durationMinutes} minutes.`,
        );
      }
      // Fixed-price bundle: overrides the normal hourlyRate x duration
      // calculation entirely for this booking.
      priceAmount = Math.round(pkg.totalPrice / pkg.sessionCount);
    } else {
      if (tutorProfile.hourlyRate == null) {
        throw new BadRequestException("This tutor has not set an hourly rate yet.");
      }
      // Locked in now (Task 5.2) - payment always charges this amount, never
      // the tutor's rate at whatever later moment payment happens.
      priceAmount = Math.round((tutorProfile.hourlyRate * dto.durationMinutes) / 60);
    }

    const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (!subject) {
      throw new BadRequestException(`Unknown subjectId: ${dto.subjectId}`);
    }

    // A tutor scheduling a session directly needs no approval from the
    // student, and no payment step either - it's fully CONFIRMED on
    // creation (the tutor is trusted to have already arranged this with
    // the student). A student's request still goes through the normal
    // REQUESTED -> accept -> pay flow.
    const initialStatus = user.role === "TUTOR" ? "CONFIRMED" : "REQUESTED";

    // No more pre-declared AvailabilitySlot row to SELECT ... FOR UPDATE -
    // any future half-hour not already booked is fair game, so instead
    // this takes a Postgres advisory lock scoped to the tutor as the
    // *first* statement in the transaction. That serializes concurrent
    // create() calls against the same tutor even when there's no row yet
    // to contend over (e.g. two people racing to book a tutor's
    // still-empty calendar) - a plain row lock can't do that. Xact-scoped
    // (not session-scoped) means it always auto-releases on commit or
    // rollback, including when the overlap check below throws; no manual
    // unlock needed. Two-argument hashtext() form for a fuller keyspace
    // than a single hashtext() call - a collision would just make two
    // unrelated tutors' bookings momentarily serialize behind each other,
    // never cause a double-booking.
    //
    // Known limitation, not a regression: only create() takes this lock.
    // accept()/counterPropose()/proposeReschedule()/respondToReschedule()
    // can also move a booking's time but don't - the old slot-based code
    // had the same gap (its conflict check was scoped to one slot, not
    // the tutor's whole calendar), so this isn't closing anything that
    // was closed before.
    const booking = await this.prisma.$transaction(async (tx) => {
      // $executeRaw, not $queryRaw - pg_advisory_xact_lock returns void,
      // and Prisma can't deserialize a resultset with no columns.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking:tutor'), hashtext(${tutorProfile.id}))`;

      const tz = getTimezoneForCity(tutorProfile.city);
      const scheduledAt = combineLocalDateTimeToUtc(dto.scheduledDate, dto.startTime, tz);
      if (user.role !== "TUTOR" && scheduledAt.getTime() <= Date.now()) {
        throw new BadRequestException("Cannot book a time in the past.");
      }
      const endAt = new Date(scheduledAt.getTime() + dto.durationMinutes * 60 * 1000);

      // No date bound - a tutor's total active-booking count is small at
      // MVP scale (same "fetch it all" pragmatism as listAllBookings() on
      // the frontend). Strict inequalities so back-to-back bookings with
      // no gap between them are allowed, not rejected as overlapping.
      const existingBookings = await tx.booking.findMany({
        where: { tutorId: tutorProfile.id, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
      });
      const overlaps = existingBookings.some((b) => {
        const existingEnd = new Date(b.scheduledAt.getTime() + b.durationMinutes * 60 * 1000);
        return b.scheduledAt.getTime() < endAt.getTime() && existingEnd.getTime() > scheduledAt.getTime();
      });
      if (overlaps) {
        throw new BadRequestException("This time is no longer available.");
      }

      const created = await tx.booking.create({
        data: {
          studentId: studentProfile.id,
          tutorId: tutorProfile.id,
          subjectId: dto.subjectId,
          packageId: dto.packageId,
          scheduledAt,
          durationMinutes: dto.durationMinutes,
          priceAmount,
          mode: dto.mode,
          notes: dto.notes,
          status: initialStatus,
          respondByAt:
            initialStatus === "REQUESTED"
              ? new Date(Date.now() + RESPONSE_WINDOW_HOURS * 60 * 60 * 1000)
              : null,
          requestedByUserId: user.id,
        },
        include: BOOKING_INCLUDE,
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          fromStatus: null,
          toStatus: initialStatus,
          changedByUserId: user.id,
        },
      });

      // Notify whichever party didn't just create this booking.
      const recipientUserId =
        user.role === "TUTOR" ? studentProfile.userId : tutorProfile.userId;
      const notificationType: NotificationType =
        initialStatus === "REQUESTED" ? "BOOKING_REQUESTED" : "BOOKING_ACCEPTED";
      await this.notifications.send(recipientUserId, notificationType, { bookingId: created.id }, tx);

      // A chat thread exists from the moment a booking request is
      // submitted (Task 4.1, PRD §6.1.D) - the Conversation row itself is
      // plain DB work and always succeeds; the Stream channel behind it
      // is created best-effort just after this transaction commits.
      await tx.conversation.create({ data: { bookingId: created.id } });

      return created;
    });

    if (initialStatus === "REQUESTED") {
      await this.expiryQueue.add(
        "expire-booking",
        { bookingId: booking.id },
        { delay: RESPONSE_WINDOW_HOURS * 60 * 60 * 1000 },
      );
    } else {
      // Tutor-initiated bookings land straight on CONFIRMED with no
      // payment step, so only the reminder side effect applies here -
      // unlike the normal accept() path, there's no payment to expire.
      await this.scheduleSessionReminders(booking.id, booking.scheduledAt);
    }

    await this.chat.createChannelForBooking(booking.id);

    return booking;
  }

  async accept(user: User, id: string): Promise<Booking> {
    return this.respond(user, id, "accept");
  }

  async decline(user: User, id: string, dto: DeclineBookingDto): Promise<Booking> {
    return this.respond(user, id, "decline", dto.reason);
  }

  async counterPropose(user: User, id: string, dto: CounterProposeBookingDto): Promise<Booking> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
      if (!booking) {
        throw new NotFoundException("No booking with that id exists.");
      }
      const actor = this.actorRoleFor(user, booking);
      const nextStatus = resolveBookingTransition(booking.status, "counter-propose", actor);
      if (!nextStatus) {
        throw new BadRequestException(
          `Cannot counter-propose a booking in ${booking.status} state.`,
        );
      }

      const tz = getTimezoneForCity(booking.tutor.city);
      const proposedScheduledAt = combineLocalDateTimeToUtc(dto.proposedDate, dto.proposedTime, tz);
      if (proposedScheduledAt.getTime() <= Date.now()) {
        throw new BadRequestException("Cannot propose a time in the past.");
      }

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedByUserId: user.id,
        },
      });

      const result = await tx.booking.update({
        where: { id },
        data: {
          status: nextStatus,
          proposedScheduledAt,
          respondByAt: new Date(Date.now() + RESPONSE_WINDOW_HOURS * 60 * 60 * 1000),
        },
        include: BOOKING_INCLUDE,
      });

      // Notify the other participant, not hardcoded to the student - only
      // ever visibly correct before now because counter-propose used to be
      // TUTOR-only (see the @Roles() removal on this route).
      const recipientUserId = actor === "TUTOR" ? booking.student.userId : booking.tutor.userId;
      await this.notifications.send(
        recipientUserId,
        "BOOKING_COUNTER_PROPOSED",
        { bookingId: id, proposedScheduledAt: proposedScheduledAt.toISOString() },
        tx,
      );

      return result;
    });

    // A fresh response window starts once the student has something new to
    // respond to - re-enqueued the same way the initial request is.
    await this.expiryQueue.add(
      "expire-booking",
      { bookingId: updated.id },
      { delay: RESPONSE_WINDOW_HOURS * 60 * 60 * 1000 },
    );

    return updated;
  }

  async proposeReschedule(user: User, id: string, dto: ProposeRescheduleDto): Promise<Booking> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
      if (!booking) {
        throw new NotFoundException("No booking with that id exists.");
      }
      const actor = this.actorRoleFor(user, booking);
      const nextStatus = resolveBookingTransition(booking.status, "reschedule-propose", actor);
      if (!nextStatus) {
        throw new BadRequestException(
          `Cannot propose a reschedule for a booking in ${booking.status} state.`,
        );
      }

      const tz = getTimezoneForCity(booking.tutor.city);
      const proposedScheduledAt = combineLocalDateTimeToUtc(dto.proposedDate, dto.proposedTime, tz);
      if (proposedScheduledAt.getTime() <= Date.now()) {
        throw new BadRequestException("Cannot propose a time in the past.");
      }

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedByUserId: user.id,
        },
      });

      const result = await tx.booking.update({
        where: { id },
        data: {
          status: nextStatus,
          proposedScheduledAt,
          rescheduleProposedByUserId: user.id,
        },
        include: BOOKING_INCLUDE,
      });

      const recipientUserId = actor === "TUTOR" ? booking.student.userId : booking.tutor.userId;
      await this.notifications.send(
        recipientUserId,
        "BOOKING_RESCHEDULE_PROPOSED",
        { bookingId: id, proposedScheduledAt: proposedScheduledAt.toISOString() },
        tx,
      );

      return result;
    });

    return updated;
  }

  async respondToReschedule(
    user: User,
    id: string,
    action: Extract<BookingResponseAction, "reschedule-accept" | "reschedule-decline">,
  ): Promise<Booking> {
    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
      if (!booking) {
        throw new NotFoundException("No booking with that id exists.");
      }
      const actor = this.actorRoleFor(user, booking);

      // Symmetric flow (either party can propose) - so unlike the original
      // request/counter-propose flow, "who's allowed to respond" isn't
      // derivable from role+status alone and has to be checked explicitly.
      if (booking.rescheduleProposedByUserId === user.id) {
        throw new BadRequestException(
          "You proposed this reschedule - waiting for the other participant to respond.",
        );
      }

      const nextStatus = resolveBookingTransition(booking.status, action, actor);
      if (!nextStatus) {
        throw new BadRequestException(
          `Cannot respond to a reschedule for a booking in ${booking.status} state.`,
        );
      }

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedByUserId: user.id,
        },
      });

      const result = await tx.booking.update({
        where: { id },
        data: {
          status: nextStatus,
          proposedScheduledAt: null,
          rescheduleProposedByUserId: null,
          ...(action === "reschedule-accept" ? { scheduledAt: booking.proposedScheduledAt! } : {}),
        },
        include: BOOKING_INCLUDE,
      });

      const recipientUserId = actor === "TUTOR" ? booking.student.userId : booking.tutor.userId;
      const notificationType: NotificationType =
        action === "reschedule-accept" ? "BOOKING_RESCHEDULE_ACCEPTED" : "BOOKING_RESCHEDULE_DECLINED";
      await this.notifications.send(recipientUserId, notificationType, { bookingId: id }, tx);

      return result;
    });

    if (action === "reschedule-accept") {
      await this.scheduleSessionReminders(result.id, result.scheduledAt);
    }

    return result;
  }

  async cancel(user: User, id: string, dto: CancelBookingDto): Promise<Booking> {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
      if (!booking) {
        throw new NotFoundException("No booking with that id exists.");
      }
      const actor = this.actorRoleFor(user, booking);
      const nextStatus = resolveBookingTransition(booking.status, "cancel", actor);
      if (!nextStatus) {
        throw new BadRequestException(`Cannot cancel a booking in ${booking.status} state.`);
      }

      const sessionEnd =
        booking.scheduledAt.getTime() + booking.durationMinutes * 60 * 1000;
      // Students cannot cancel a session that has already ended; tutors can
      // (including COMPLETED → CANCELLED) so past mistakes stay correctable
      // and show as cancelled (red) on calendars.
      if (actor !== "TUTOR" && sessionEnd <= Date.now()) {
        throw new BadRequestException("Cannot cancel a session that has already ended.");
      }

      if (booking.deletedAt) {
        throw new BadRequestException("Cannot cancel a deleted session.");
      }

      // Only a booking that had actually been committed to (ACCEPTED, a
      // reschedule pending on top of that, or already-paid CONFIRMED) can
      // incur a late-cancellation flag - withdrawing a still-pending
      // REQUESTED/COUNTER_PROPOSED booking is always free since nothing
      // was confirmed yet.
      const wasCommitted =
        booking.status === "ACCEPTED" ||
        booking.status === "RESCHEDULE_PROPOSED" ||
        booking.status === "CONFIRMED";
      const hoursUntilSession = (booking.scheduledAt.getTime() - Date.now()) / (60 * 60 * 1000);
      const isLateCancellation = wasCommitted && hoursUntilSession < FREE_CANCELLATION_WINDOW_HOURS;

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedByUserId: user.id,
          reason: dto.details,
        },
      });

      const result = await tx.booking.update({
        where: { id },
        data: {
          status: nextStatus,
          cancelledAt: new Date(),
          cancelledByUserId: user.id,
          cancellationReasonCode: dto.reasonCode,
          cancellationReason: dto.details,
          isLateCancellation,
          proposedScheduledAt: null,
          rescheduleProposedByUserId: null,
        },
        include: BOOKING_INCLUDE,
      });

      const recipientUserId = actor === "TUTOR" ? booking.student.userId : booking.tutor.userId;
      await this.notifications.send(
        recipientUserId,
        "BOOKING_CANCELLED",
        { bookingId: id, isLateCancellation },
        tx,
      );

      return result;
    });
  }

  // Tutor-only soft-delete: hides the session from calendars and lists.
  // The row stays for history/payments/disputes. Distinct from cancel,
  // which keeps the session visible (styled red) on calendars.
  async softDelete(tutor: User, id: string): Promise<{ id: string; deletedAt: Date }> {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    if (this.actorRoleFor(tutor, booking) !== "TUTOR") {
      throw new ForbiddenException("Only the tutor can delete this session.");
    }
    if (booking.deletedAt) {
      throw new BadRequestException("This session is already deleted.");
    }

    const result = await this.prisma.booking.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedByUserId: tutor.id,
      },
    });

    return { id: result.id, deletedAt: result.deletedAt! };
  }

  // Direct edit, no counterparty approval - only for a CONFIRMED booking the
  // tutor scheduled themselves (requestedByUserId === tutor.id, the same
  // trust boundary create() uses to skip negotiation entirely). A
  // student-requested booking keeps using proposeReschedule/
  // respondToReschedule instead.
  async editForTutor(tutor: User, id: string, dto: UpdateBookingDto): Promise<Booking> {
    if ((dto.scheduledDate && !dto.startTime) || (!dto.scheduledDate && dto.startTime)) {
      throw new BadRequestException("scheduledDate and startTime must be provided together.");
    }

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
      if (!booking) {
        throw new NotFoundException("No booking with that id exists.");
      }
      if (this.actorRoleFor(tutor, booking) !== "TUTOR") {
        throw new ForbiddenException("You are not the tutor for this booking.");
      }
      if (booking.requestedByUserId !== tutor.id) {
        throw new ForbiddenException("You can only directly edit sessions you scheduled yourself.");
      }
      if (booking.status !== "CONFIRMED") {
        throw new BadRequestException(`Cannot directly edit a booking in ${booking.status} state.`);
      }
      if (booking.scheduledAt.getTime() <= Date.now()) {
        throw new BadRequestException("Cannot edit a session that has already started.");
      }

      const pkg = booking.packageId
        ? await tx.tutoringPackage.findUnique({ where: { id: booking.packageId } })
        : null;
      if (pkg && dto.durationMinutes != null && dto.durationMinutes !== pkg.durationMinutes) {
        throw new BadRequestException("Duration is fixed by the selected package.");
      }

      let scheduledAt = booking.scheduledAt;
      if (dto.scheduledDate && dto.startTime) {
        const tz = getTimezoneForCity(booking.tutor.city);
        scheduledAt = combineLocalDateTimeToUtc(dto.scheduledDate, dto.startTime, tz);
        if (scheduledAt.getTime() <= Date.now()) {
          throw new BadRequestException("Cannot book a time in the past.");
        }
      }

      const durationMinutes = dto.durationMinutes ?? booking.durationMinutes;
      const timeOrDurationChanged =
        scheduledAt.getTime() !== booking.scheduledAt.getTime() ||
        durationMinutes !== booking.durationMinutes;

      if (timeOrDurationChanged) {
        // Same advisory-lock + whole-calendar overlap check as create(),
        // scoped to this tutor and excluding this booking's own id.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking:tutor'), hashtext(${booking.tutorId}))`;

        const endAt = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
        const existingBookings = await tx.booking.findMany({
          where: {
            tutorId: booking.tutorId,
            id: { not: booking.id },
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
          },
        });
        const overlaps = existingBookings.some((b) => {
          const existingEnd = new Date(b.scheduledAt.getTime() + b.durationMinutes * 60 * 1000);
          return (
            b.scheduledAt.getTime() < endAt.getTime() && existingEnd.getTime() > scheduledAt.getTime()
          );
        });
        if (overlaps) {
          throw new BadRequestException("This time is no longer available.");
        }
      }

      let subjectId = booking.subjectId;
      if (dto.subjectId && dto.subjectId !== booking.subjectId) {
        const subject = await tx.subject.findUnique({ where: { id: dto.subjectId } });
        if (!subject) {
          throw new BadRequestException(`Unknown subjectId: ${dto.subjectId}`);
        }
        subjectId = dto.subjectId;
      }

      // Package-priced bookings keep their package-derived price untouched -
      // only a duration change on a non-package booking recomputes it.
      let priceAmount = booking.priceAmount;
      if (durationMinutes !== booking.durationMinutes && !pkg) {
        if (booking.tutor.hourlyRate == null) {
          throw new BadRequestException("This tutor has not set an hourly rate yet.");
        }
        priceAmount = Math.round((booking.tutor.hourlyRate * durationMinutes) / 60);
      }

      const updated = await tx.booking.update({
        where: { id },
        data: {
          scheduledAt,
          durationMinutes,
          subjectId,
          mode: dto.mode ?? booking.mode,
          notes: dto.notes !== undefined ? dto.notes : booking.notes,
          priceAmount,
        },
        include: BOOKING_INCLUDE,
      });

      await this.notifications.send(
        booking.student.userId,
        "SESSION_EDITED",
        { bookingId: id },
        tx,
      );

      return updated;
    });
  }

  async reportNoShow(user: User, id: string): Promise<Booking> {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
      if (!booking) {
        throw new NotFoundException("No booking with that id exists.");
      }
      const actor = this.actorRoleFor(user, booking);
      // CONFIRMED (paid) is included alongside ACCEPTED (Sprint 6 fix) -
      // Sprint 5 introduced CONFIRMED as the normal state a booking sits in
      // by the time its session actually happens (ACCEPTED only lasts
      // until payment), so restricting this to ACCEPTED-only would have
      // made no-show reporting unreachable for the common paid-booking
      // path.
      if (booking.status !== "ACCEPTED" && booking.status !== "CONFIRMED") {
        throw new BadRequestException(
          "Only an accepted or confirmed booking can be reported as a no-show.",
        );
      }
      if (booking.scheduledAt.getTime() > Date.now()) {
        throw new BadRequestException("Cannot report a no-show before the scheduled session time.");
      }
      if (booking.noShowReported) {
        throw new BadRequestException("A no-show has already been reported for this booking.");
      }

      const result = await tx.booking.update({
        where: { id },
        data: {
          noShowReported: true,
          noShowReportedByUserId: user.id,
          noShowReportedAt: new Date(),
        },
        include: BOOKING_INCLUDE,
      });

      const recipientUserId = actor === "TUTOR" ? booking.student.userId : booking.tutor.userId;
      await this.notifications.send(recipientUserId, "BOOKING_NO_SHOW_REPORTED", { bookingId: id }, tx);

      return result;
    });
  }

  // Either party can set/update the meeting link (ONLINE) or address
  // (OFFLINE) tied to the booking (Task 4.3) - stored on Booking, not
  // parsed out of chat messages, so Sprint 6's "Join Meeting" button has
  // a reliable field to read.
  async setMeetingInfo(user: User, id: string, dto: SetMeetingDto): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    this.actorRoleFor(user, booking);

    if (booking.mode === "ONLINE") {
      if (!dto.meetingLink) {
        throw new BadRequestException("meetingLink is required for an online booking.");
      }
      if (!isValidMeetingLink(dto.meetingLink)) {
        throw new BadRequestException("meetingLink must be a valid Zoom or Google Meet URL.");
      }
    } else if (!dto.meetingAddress || dto.meetingAddress.trim().length === 0) {
      throw new BadRequestException("meetingAddress is required for an offline booking.");
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        meetingLink: booking.mode === "ONLINE" ? dto.meetingLink : null,
        meetingAddress: booking.mode === "OFFLINE" ? dto.meetingAddress : null,
        meetingSetByUserId: user.id,
        meetingSetAt: new Date(),
      },
      include: BOOKING_INCLUDE,
    });
  }

  // Manual "Tandai Selesai" (Task 6.1) - tutor-only per the product
  // decision documented in the sprint's changes.md (MVP trust level: the
  // tutor is the one physically present at/leading the session). Can only
  // fire once the session's scheduled end time has actually passed, so a
  // tutor can't pre-emptively complete (and unlock payout eligibility for)
  // a session that hasn't happened yet.
  async complete(user: User, id: string): Promise<Booking> {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
      if (!booking) {
        throw new NotFoundException("No booking with that id exists.");
      }
      const actor = this.actorRoleFor(user, booking);
      if (actor !== "TUTOR") {
        throw new ForbiddenException("Only the tutor can mark a session complete.");
      }
      if (booking.status !== "CONFIRMED") {
        throw new BadRequestException(`Cannot complete a booking in ${booking.status} state.`);
      }
      const scheduledEnd = booking.scheduledAt.getTime() + booking.durationMinutes * 60 * 1000;
      if (scheduledEnd > Date.now()) {
        throw new BadRequestException("Cannot mark a session complete before it has occurred.");
      }

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: "COMPLETED",
          changedByUserId: user.id,
          reason: "Ditandai selesai oleh tutor",
        },
      });

      const result = await tx.booking.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date(), completedByUserId: user.id },
        include: BOOKING_INCLUDE,
      });

      await this.notifications.send(booking.student.userId, "REVIEW_PROMPT", { bookingId: id }, tx);

      return result;
    });
  }

  // Free-text only (Task 6.3) - tutor-writable, student-read-only.
  // Allowed once the session has ended: COMPLETED, or CONFIRMED after the
  // scheduled end time (so tutors can leave notes without marking complete
  // first). Exception: a tutor-initiated booking (requestedByUserId is the
  // tutor's own userId) skips the "session ended" wait entirely - it was
  // never gated on student approval or payment either, so there's nothing
  // stopping the tutor from writing the report as soon as it's scheduled.
  async addNotes(user: User, id: string, dto: AddSessionNotesDto): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    const actor = this.actorRoleFor(user, booking);
    if (actor !== "TUTOR") {
      throw new ForbiddenException("Only the tutor can add session notes.");
    }
    const scheduledEnd = booking.scheduledAt.getTime() + booking.durationMinutes * 60 * 1000;
    const sessionEnded = scheduledEnd <= Date.now();
    const isTutorInitiated = booking.requestedByUserId === booking.tutor.userId;
    const canAddNotes =
      booking.status === "COMPLETED" ||
      (booking.status === "CONFIRMED" && (sessionEnded || isTutorInitiated));
    if (!canAddNotes) {
      throw new BadRequestException(
        "Session notes can only be added after the session has ended.",
      );
    }

    return this.prisma.booking.update({
      where: { id },
      data: { sessionNotes: dto.notes, sessionNotesUpdatedAt: new Date() },
      include: BOOKING_INCLUDE,
    });
  }

  // Tutor uploads an image to embed inline in sessionNotes' HTML. Returns
  // only the id - the client embeds it as `attachment:<id>` (see
  // sanitizeHtml.ts), never a real, browser-fetchable URL.
  async uploadImage(
    user: User,
    bookingId: string,
    file: Express.Multer.File,
  ): Promise<{ id: string }> {
    const attachment = await this.saveAttachment(
      user,
      bookingId,
      file,
      "INLINE_IMAGE",
      ALLOWED_IMAGE_MIME_TYPES,
      MAX_IMAGE_SIZE_BYTES,
    );
    return { id: attachment.id };
  }

  // Tutor uploads a standalone document attached to the session report,
  // distinct from an inline image - listed and downloaded separately
  // rather than embedded in the notes text.
  async uploadDocument(
    user: User,
    bookingId: string,
    file: Express.Multer.File,
  ): Promise<BookingAttachment> {
    return this.saveAttachment(
      user,
      bookingId,
      file,
      "DOCUMENT",
      ALLOWED_DOCUMENT_MIME_TYPES,
      MAX_DOCUMENT_SIZE_BYTES,
    );
  }

  private async saveAttachment(
    user: User,
    bookingId: string,
    file: Express.Multer.File,
    kind: BookingAttachmentKind,
    allowedMimeTypes: string[],
    maxSizeBytes: number,
  ): Promise<BookingAttachment> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    const actor = this.actorRoleFor(user, booking);
    if (actor !== "TUTOR") {
      throw new ForbiddenException("Only the tutor can add attachments to a session report.");
    }
    if (!file) {
      throw new BadRequestException("No file was uploaded.");
    }
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: ${allowedMimeTypes.join(", ")}`,
      );
    }
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(`File is too large. Max size: ${maxSizeBytes} bytes.`);
    }

    const ext = (file.originalname.split(".").pop() ?? "bin").toLowerCase();
    const storagePath = await this.storage.save(
      `booking-attachments/${bookingId}`,
      `${randomBytes(16).toString("hex")}.${ext}`,
      file.buffer,
    );

    return this.prisma.bookingAttachment.create({
      data: {
        bookingId,
        uploadedByUserId: user.id,
        kind,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath,
      },
    });
  }

  // Either participant may list a booking's standalone document
  // attachments (Task: session-report attachments) - inline images aren't
  // listed here, they live inside sessionNotes' HTML.
  async listAttachments(user: User, bookingId: string): Promise<BookingAttachment[]> {
    const booking = await this.requireParticipant(user, bookingId);
    return this.prisma.bookingAttachment.findMany({
      where: { bookingId: booking.id, kind: "DOCUMENT" },
      orderBy: { createdAt: "asc" },
    });
  }

  // Either participant may fetch attachment bytes - used both for
  // downloading a DOCUMENT attachment and for hydrating an INLINE_IMAGE
  // referenced from sessionNotes' HTML (see hydrateAttachmentImages.ts on
  // the frontend, which is the only thing that ever calls this route).
  async getAttachmentFile(
    user: User,
    bookingId: string,
    attachmentId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    await this.requireParticipant(user, bookingId);
    const attachment = await this.requireOwnedAttachment(bookingId, attachmentId);
    const buffer = await this.storage.read(attachment.storagePath);
    return { buffer, mimeType: attachment.mimeType, filename: attachment.filename };
  }

  async deleteAttachment(
    user: User,
    bookingId: string,
    attachmentId: string,
  ): Promise<{ ok: true }> {
    const booking = await this.requireParticipant(user, bookingId);
    const actor = this.actorRoleFor(user, booking);
    if (actor !== "TUTOR") {
      throw new ForbiddenException("Only the tutor can remove a session report attachment.");
    }
    await this.requireOwnedAttachment(bookingId, attachmentId);
    await this.prisma.bookingAttachment.delete({ where: { id: attachmentId } });
    return { ok: true };
  }

  private async requireParticipant(user: User, bookingId: string): Promise<BookingWithInclude> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    this.actorRoleFor(user, booking); // throws ForbiddenException for a non-participant
    return booking;
  }

  private async requireOwnedAttachment(
    bookingId: string,
    attachmentId: string,
  ): Promise<BookingAttachment> {
    const attachment = await this.prisma.bookingAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment || attachment.bookingId !== bookingId) {
      throw new NotFoundException("No attachment with that id exists on this booking.");
    }
    return attachment;
  }

  private async respond(
    user: User,
    id: string,
    action: Extract<BookingResponseAction, "accept" | "decline">,
    reason?: string,
  ): Promise<Booking> {
    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
      if (!booking) {
        throw new NotFoundException("No booking with that id exists.");
      }
      const actor = this.actorRoleFor(user, booking);
      const nextStatus = resolveBookingTransition(booking.status, action, actor);
      if (!nextStatus) {
        throw new BadRequestException(`Cannot ${action} a booking in ${booking.status} state.`);
      }

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedByUserId: user.id,
          reason: action === "decline" ? reason : undefined,
        },
      });

      const data: Prisma.BookingUpdateInput = { status: nextStatus };
      if (action === "decline") {
        data.declineReason = reason;
      }
      if (action === "accept" && booking.status === "COUNTER_PROPOSED") {
        data.scheduledAt = booking.proposedScheduledAt!;
      }

      const result = await tx.booking.update({
        where: { id },
        data,
        include: BOOKING_INCLUDE,
      });

      const recipientUserId = actor === "TUTOR" ? booking.student.userId : booking.tutor.userId;
      const notificationType: NotificationType =
        action === "accept" ? "BOOKING_ACCEPTED" : "BOOKING_DECLINED";
      await this.notifications.send(recipientUserId, notificationType, { bookingId: id }, tx);

      return result;
    });

    if (action === "accept") {
      await this.scheduleSessionReminders(result.id, result.scheduledAt);
      await this.payments.schedulePaymentExpiry(result.id);
    }

    return result;
  }

  async findOne(user: User, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!booking || booking.deletedAt) {
      throw new NotFoundException("No booking with that id exists.");
    }
    this.actorRoleFor(user, booking);
    return booking;
  }

  async findMany(user: User, query: ListBookingsDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const empty = { data: [] as Booking[], total: 0, page, limit };

    let scopeWhere: Prisma.BookingWhereInput;
    if (user.role === "STUDENT") {
      const studentProfile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
      });
      if (!studentProfile) return empty;
      scopeWhere = { studentId: studentProfile.id };
    } else if (user.role === "TUTOR") {
      const tutorProfile = await this.prisma.tutorProfile.findUnique({
        where: { userId: user.id },
      });
      if (!tutorProfile) return empty;
      scopeWhere = { tutorId: tutorProfile.id };
    } else {
      return empty;
    }

    const bucketWhere = this.bucketWhere(query.bucket);
    const where: Prisma.BookingWhereInput = {
      AND: [scopeWhere, { deletedAt: null }, ...(bucketWhere ? [bucketWhere] : [])],
    };

    // Past/cancelled read most-recent-first; upcoming reads soonest-first -
    // whichever ordering is most useful to scan for that tab.
    const orderDirection = query.bucket === "upcoming" || !query.bucket ? "asc" : "desc";

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { scheduledAt: orderDirection },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // Shared bucketing rule (Task 3.4): kept in this single backend query
  // rather than duplicated per-client, so web/mobile never disagree on
  // what counts as upcoming vs. past vs. cancelled.
  private bucketWhere(bucket?: BookingListBucket): Prisma.BookingWhereInput | null {
    if (!bucket) return null;
    const now = new Date();

    if (bucket === "cancelled") {
      return { status: { in: [...CANCELLED_LIKE_BOOKING_STATUSES] } };
    }
    if (bucket === "past") {
      return {
        OR: [
          { status: "COMPLETED" },
          { status: { in: [...ACTIVE_BOOKING_STATUSES] }, scheduledAt: { lt: now } },
        ],
      };
    }
    return { status: { in: [...ACTIVE_BOOKING_STATUSES] }, scheduledAt: { gte: now } };
  }

  async history(user: User, id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    if (!booking) {
      throw new NotFoundException("No booking with that id exists.");
    }
    this.actorRoleFor(user, booking);
    return this.prisma.bookingStatusHistory.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: "asc" },
    });
  }

  private actorRoleFor(user: User, booking: BookingWithParticipants): BookingActor {
    if (booking.tutor.userId === user.id) return "TUTOR";
    if (booking.student.userId === user.id) return "STUDENT";
    throw new ForbiddenException("You are not a participant in this booking.");
  }
}
