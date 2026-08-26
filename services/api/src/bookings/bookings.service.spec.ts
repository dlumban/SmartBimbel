import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { User } from "@prisma/client";
import { Queue } from "bullmq";
import { BookingsService } from "./bookings.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ChatService } from "../chat/chat.service";
import { PaymentsService } from "../payments/payments.service";
import { StorageService } from "../storage/storage.service";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    role: "STUDENT",
    phone: null,
    email: null,
    name: null,
    firebaseUid: "fb-1",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

const baseDto = {
  tutorId: "tp1",
  startTime: "10:00",
  subjectId: "s1",
  scheduledDate: "2030-08-18",
  durationMinutes: 60 as const,
  mode: "ONLINE" as const,
};

describe("BookingsService.create (pre-transaction validation)", () => {
  let prisma: {
    studentProfile: { findUnique: jest.Mock };
    tutorProfile: { findUnique: jest.Mock };
    subject: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let notifications: { send: jest.Mock };
  let chat: { createChannelForBooking: jest.Mock };
  let payments: { schedulePaymentExpiry: jest.Mock };
  let storage: { save: jest.Mock; read: jest.Mock };
  let queue: { add: jest.Mock };
  let reminderQueue: { add: jest.Mock };
  let service: BookingsService;

  beforeEach(() => {
    prisma = {
      studentProfile: { findUnique: jest.fn() },
      tutorProfile: { findUnique: jest.fn() },
      subject: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    notifications = { send: jest.fn().mockResolvedValue({}) };
    chat = { createChannelForBooking: jest.fn().mockResolvedValue(undefined) };
    payments = { schedulePaymentExpiry: jest.fn().mockResolvedValue(undefined) };
    storage = { save: jest.fn().mockResolvedValue("path"), read: jest.fn() };
    queue = { add: jest.fn() };
    reminderQueue = { add: jest.fn() };
    service = new BookingsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      chat as unknown as ChatService,
      payments as unknown as PaymentsService,
      storage as unknown as StorageService,
      queue as unknown as Queue,
      reminderQueue as unknown as Queue,
    );
  });

  it("throws NotFoundException when the student has no profile", async () => {
    prisma.studentProfile.findUnique.mockResolvedValue(null);
    await expect(service.create(makeUser(), baseDto)).rejects.toThrow(NotFoundException);
  });

  it("throws NotFoundException for a nonexistent or unverified tutor", async () => {
    prisma.studentProfile.findUnique.mockResolvedValue({ id: "sp1" });
    prisma.tutorProfile.findUnique.mockResolvedValue(null);
    await expect(service.create(makeUser(), baseDto)).rejects.toThrow(NotFoundException);

    prisma.tutorProfile.findUnique.mockResolvedValue({
      id: "tp1",
      verificationStatus: "PENDING",
      teachingModes: ["ONLINE"],
    });
    await expect(service.create(makeUser(), baseDto)).rejects.toThrow(NotFoundException);
  });

  it("throws BadRequestException when the tutor doesn't offer the requested mode", async () => {
    prisma.studentProfile.findUnique.mockResolvedValue({ id: "sp1" });
    prisma.tutorProfile.findUnique.mockResolvedValue({
      id: "tp1",
      verificationStatus: "VERIFIED",
      teachingModes: ["OFFLINE"],
      city: "Jakarta Selatan",
    });
    await expect(service.create(makeUser(), baseDto)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws BadRequestException for an unknown subjectId", async () => {
    prisma.studentProfile.findUnique.mockResolvedValue({ id: "sp1" });
    prisma.tutorProfile.findUnique.mockResolvedValue({
      id: "tp1",
      verificationStatus: "VERIFIED",
      teachingModes: ["ONLINE"],
      city: "Jakarta Selatan",
      hourlyRate: 100000,
    });
    prisma.subject.findUnique.mockResolvedValue(null);
    await expect(service.create(makeUser(), baseDto)).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when the tutor hasn't set an hourly rate", async () => {
    prisma.studentProfile.findUnique.mockResolvedValue({ id: "sp1" });
    prisma.tutorProfile.findUnique.mockResolvedValue({
      id: "tp1",
      verificationStatus: "VERIFIED",
      teachingModes: ["ONLINE"],
      city: "Jakarta Selatan",
      hourlyRate: null,
    });
    await expect(service.create(makeUser(), baseDto)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("enqueues an expiry job after a successful transaction", async () => {
    prisma.studentProfile.findUnique.mockResolvedValue({ id: "sp1" });
    prisma.tutorProfile.findUnique.mockResolvedValue({
      id: "tp1",
      verificationStatus: "VERIFIED",
      teachingModes: ["ONLINE"],
      city: "Jakarta Selatan",
      hourlyRate: 100000,
    });
    prisma.subject.findUnique.mockResolvedValue({ id: "s1" });
    prisma.$transaction.mockResolvedValue({ id: "booking1" });

    const result = await service.create(makeUser(), baseDto);

    expect(result).toEqual({ id: "booking1" });
    expect(queue.add).toHaveBeenCalledWith(
      "expire-booking",
      { bookingId: "booking1" },
      { delay: 24 * 60 * 60 * 1000 },
    );
    expect(chat.createChannelForBooking).toHaveBeenCalledWith("booking1");
  });

  describe("tutor-initiated (studentId instead of tutorId)", () => {
    const tutorUser = makeUser({ id: "tutor-1", role: "TUTOR" });

    it("throws BadRequestException when a tutor omits studentId", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue({
        id: "tp1",
        teachingModes: ["ONLINE"],
        city: "Jakarta Selatan",
        hourlyRate: 100000,
      });
      await expect(
        service.create(tutorUser, { ...baseDto, tutorId: undefined }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the tutor has no profile yet", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.create(tutorUser, { ...baseDto, tutorId: undefined, studentId: "sp1" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the target student doesn't exist", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue({
        id: "tp1",
        teachingModes: ["ONLINE"],
        city: "Jakarta Selatan",
        hourlyRate: 100000,
      });
      prisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.create(tutorUser, { ...baseDto, tutorId: undefined, studentId: "sp-nonexistent" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("creates the booking as CONFIRMED (no approval or payment needed), sets requestedByUserId, and notifies the student", async () => {
      prisma.tutorProfile.findUnique.mockResolvedValue({
        id: "tp1",
        teachingModes: ["ONLINE"],
        city: "Jakarta Selatan",
        hourlyRate: 100000,
      });
      prisma.studentProfile.findUnique.mockResolvedValue({ id: "sp1", userId: "student-1" });
      prisma.subject.findUnique.mockResolvedValue({ id: "s1" });

      let capturedCreateData: Record<string, unknown> | undefined;
      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          booking: {
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
              capturedCreateData = data;
              return Promise.resolve({ id: "booking1", scheduledAt: data.scheduledAt });
            }),
          },
          bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
          conversation: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      await service.create(tutorUser, {
        ...baseDto,
        tutorId: undefined,
        studentId: "sp1",
        scheduledDate: "2026-11-17",
      });

      expect(capturedCreateData).toEqual(
        expect.objectContaining({
          studentId: "sp1",
          tutorId: "tp1",
          requestedByUserId: "tutor-1",
          status: "CONFIRMED",
          respondByAt: null,
        }),
      );
      expect(notifications.send).toHaveBeenCalledWith(
        "student-1",
        "BOOKING_ACCEPTED",
        { bookingId: "booking1" },
        expect.anything(),
      );
      // Immediately confirmed - no response window to expire, and no
      // payment to expire either since there's no payment step for a
      // tutor-initiated booking. Reminders still get scheduled.
      expect(queue.add).not.toHaveBeenCalled();
      expect(reminderQueue.add).toHaveBeenCalled();
      expect(payments.schedulePaymentExpiry).not.toHaveBeenCalled();
    });
  });

  describe("packageId (fixed-price bundle)", () => {
    function setUpValidTutorAndStudent() {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: "sp1" });
      prisma.tutorProfile.findUnique.mockResolvedValue({
        id: "tp1",
        verificationStatus: "VERIFIED",
        teachingModes: ["ONLINE"],
        city: "Jakarta Selatan",
        hourlyRate: 100000,
      });
      prisma.subject.findUnique.mockResolvedValue({ id: "s1" });
    }

    let capturedCreateData: Record<string, unknown> | undefined;
    function mockTransaction() {
      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          booking: {
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
              capturedCreateData = data;
              return Promise.resolve({ id: "booking1", ...data });
            }),
          },
          bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
          conversation: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });
    }

    it("prices the booking from the package instead of the hourly rate", async () => {
      setUpValidTutorAndStudent();
      (prisma as unknown as { tutoringPackage: { findUnique: jest.Mock } }).tutoringPackage = {
        findUnique: jest.fn().mockResolvedValue({
          id: "pkg1",
          durationMinutes: 60,
          sessionCount: 4,
          totalPrice: 400000,
          isActive: true,
        }),
      };
      mockTransaction();

      await service.create(makeUser(), { ...baseDto, packageId: "pkg1" });

      expect(capturedCreateData).toEqual(
        expect.objectContaining({ packageId: "pkg1", priceAmount: 100000 }),
      );
    });

    it("rejects an unknown or inactive packageId", async () => {
      setUpValidTutorAndStudent();
      (prisma as unknown as { tutoringPackage: { findUnique: jest.Mock } }).tutoringPackage = {
        findUnique: jest.fn().mockResolvedValue(null),
      };

      await expect(
        service.create(makeUser(), { ...baseDto, packageId: "pkg1" }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects a durationMinutes that doesn't match the package's fixed duration", async () => {
      setUpValidTutorAndStudent();
      (prisma as unknown as { tutoringPackage: { findUnique: jest.Mock } }).tutoringPackage = {
        findUnique: jest.fn().mockResolvedValue({
          id: "pkg1",
          durationMinutes: 90,
          sessionCount: 4,
          totalPrice: 400000,
          isActive: true,
        }),
      };

      await expect(
        service.create(makeUser(), { ...baseDto, packageId: "pkg1", durationMinutes: 60 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // baseDto is scheduledDate "2030-08-18" + startTime "10:00" against a
  // tutor in Jakarta Selatan (WIB, UTC+7) with durationMinutes 60, so the
  // new booking's real (non-mocked) computed range is always
  // [2030-08-18T03:00:00Z, 2030-08-18T04:00:00Z) - every existing-booking
  // fixture below is expressed relative to that fixed window.
  describe("overlap check (no more AvailabilitySlot to lock)", () => {
    function setUpValidTutorAndStudent() {
      prisma.studentProfile.findUnique.mockResolvedValue({ id: "sp1" });
      prisma.tutorProfile.findUnique.mockResolvedValue({
        id: "tp1",
        verificationStatus: "VERIFIED",
        teachingModes: ["ONLINE"],
        city: "Jakarta Selatan",
        hourlyRate: 100000,
      });
      prisma.subject.findUnique.mockResolvedValue({ id: "s1" });
    }

    function mockTransactionWithExisting(existing: { scheduledAt: string; durationMinutes: number }[]) {
      const executeRawMock = jest.fn().mockResolvedValue(undefined);
      const findManyMock = jest.fn().mockResolvedValue(
        existing.map((b) => ({ scheduledAt: new Date(b.scheduledAt), durationMinutes: b.durationMinutes })),
      );
      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
        const tx = {
          $executeRaw: executeRawMock,
          booking: {
            findMany: findManyMock,
            create: jest.fn().mockResolvedValue({ id: "booking1", scheduledAt: new Date() }),
          },
          bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
          conversation: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });
      return { executeRawMock, findManyMock };
    }

    it("acquires the advisory lock before reading existing bookings", async () => {
      setUpValidTutorAndStudent();
      const { executeRawMock, findManyMock } = mockTransactionWithExisting([]);

      await service.create(makeUser(), baseDto);

      expect(executeRawMock).toHaveBeenCalled();
      const lockCallSql = (executeRawMock.mock.calls[0][0] as TemplateStringsArray).join("");
      expect(lockCallSql).toContain("pg_advisory_xact_lock");
      expect(executeRawMock.mock.invocationCallOrder[0]).toBeLessThan(
        findManyMock.mock.invocationCallOrder[0],
      );
    });

    it.each([
      ["exact match", { scheduledAt: "2030-08-18T03:00:00.000Z", durationMinutes: 60 }],
      ["new starts mid-existing", { scheduledAt: "2030-08-18T02:30:00.000Z", durationMinutes: 60 }],
      ["new ends mid-existing", { scheduledAt: "2030-08-18T03:30:00.000Z", durationMinutes: 60 }],
      ["new fully contains existing", { scheduledAt: "2030-08-18T03:15:00.000Z", durationMinutes: 30 }],
      ["existing fully contains new", { scheduledAt: "2030-08-18T02:00:00.000Z", durationMinutes: 180 }],
    ])("rejects when the new time overlaps an existing booking (%s)", async (_label, existing) => {
      setUpValidTutorAndStudent();
      mockTransactionWithExisting([existing]);

      await expect(service.create(makeUser(), baseDto)).rejects.toThrow(BadRequestException);
    });

    it.each([
      ["existing ends exactly when new starts", { scheduledAt: "2030-08-18T02:00:00.000Z", durationMinutes: 60 }],
      ["existing starts exactly when new ends", { scheduledAt: "2030-08-18T04:00:00.000Z", durationMinutes: 60 }],
    ])("allows back-to-back bookings with no gap (%s)", async (_label, existing) => {
      setUpValidTutorAndStudent();
      mockTransactionWithExisting([existing]);

      await expect(service.create(makeUser(), baseDto)).resolves.toBeDefined();
    });

    it("ignores non-active (e.g. cancelled) bookings entirely", async () => {
      // findMany itself is already scoped to ACTIVE_BOOKING_STATUSES in
      // the real where-clause; this just documents that an empty result
      // (as if a cancelled booking were filtered out server-side) allows
      // the new booking through even at the exact same time.
      setUpValidTutorAndStudent();
      mockTransactionWithExisting([]);

      await expect(service.create(makeUser(), baseDto)).resolves.toBeDefined();
    });
  });
});

interface FakeTx {
  booking: { findUnique: jest.Mock; update: jest.Mock };
  bookingStatusHistory: { create: jest.Mock };
}

describe("BookingsService response actions (accept/decline/counter-propose)", () => {
  let prisma: {
    $transaction: jest.Mock;
    booking: { findUnique: jest.Mock; update: jest.Mock };
    bookingAttachment: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
  };
  let notifications: { send: jest.Mock };
  let chat: { createChannelForBooking: jest.Mock };
  let payments: { schedulePaymentExpiry: jest.Mock };
  let storage: { save: jest.Mock; read: jest.Mock };
  let queue: { add: jest.Mock };
  let reminderQueue: { add: jest.Mock };
  let service: BookingsService;
  let tx: FakeTx;

  const tutorUser = makeUser({ id: "tutor-user-1", role: "TUTOR" });
  const studentUser = makeUser({ id: "student-user-1", role: "STUDENT" });
  const strangerUser = makeUser({ id: "stranger-1", role: "STUDENT" });

  function makeBooking(overrides: Record<string, unknown> = {}) {
    return {
      id: "b1",
      status: "REQUESTED",
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      student: { userId: "student-user-1" },
      tutor: { userId: "tutor-user-1", city: "Jakarta Selatan" },
      proposedScheduledAt: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    tx = {
      booking: { findUnique: jest.fn(), update: jest.fn() },
      bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      $transaction: jest.fn((cb: (tx: FakeTx) => unknown) => cb(tx)),
      booking: { findUnique: jest.fn(), update: jest.fn() },
      bookingAttachment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };
    notifications = { send: jest.fn().mockResolvedValue({}) };
    chat = { createChannelForBooking: jest.fn().mockResolvedValue(undefined) };
    payments = { schedulePaymentExpiry: jest.fn().mockResolvedValue(undefined) };
    storage = { save: jest.fn().mockResolvedValue("path"), read: jest.fn() };
    queue = { add: jest.fn() };
    reminderQueue = { add: jest.fn() };
    service = new BookingsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      chat as unknown as ChatService,
      payments as unknown as PaymentsService,
      storage as unknown as StorageService,
      queue as unknown as Queue,
      reminderQueue as unknown as Queue,
    );
  });

  describe("accept", () => {
    it("moves REQUESTED -> ACCEPTED when the tutor accepts and notifies the student", async () => {
      const booking = makeBooking();
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, status: "ACCEPTED" });

      const result = await service.accept(tutorUser, "b1");

      expect(result.status).toBe("ACCEPTED");
      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: { status: "ACCEPTED" },
        include: expect.anything(),
      });
      expect(notifications.send).toHaveBeenCalledWith(
        "student-user-1",
        "BOOKING_ACCEPTED",
        { bookingId: "b1" },
        tx,
      );
      // Both the 24h and 1h reminders get scheduled once a booking lands
      // on ACCEPTED - the fixture's scheduledAt is 7 days out, so both
      // windows are still ahead of now.
      expect(reminderQueue.add).toHaveBeenCalledTimes(2);
      expect(reminderQueue.add).toHaveBeenCalledWith(
        "session-reminder",
        expect.objectContaining({ bookingId: "b1", reminderType: "24H" }),
        expect.objectContaining({ delay: expect.any(Number) }),
      );
      expect(reminderQueue.add).toHaveBeenCalledWith(
        "session-reminder",
        expect.objectContaining({ bookingId: "b1", reminderType: "1H" }),
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });

    it("does not schedule reminders when declining", async () => {
      const booking = makeBooking();
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, status: "DECLINED" });

      await service.decline(tutorUser, "b1", {});

      expect(reminderQueue.add).not.toHaveBeenCalled();
    });

    it("skips a reminder whose window has already passed", async () => {
      const booking = makeBooking({
        // 2 hours out - the 24h-before window is already in the past
        // (would need a delay of -22h), but the 1h-before window is still
        // ahead (delay of +1h).
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, status: "ACCEPTED" });

      await service.accept(tutorUser, "b1");

      expect(reminderQueue.add).toHaveBeenCalledTimes(1);
      expect(reminderQueue.add).toHaveBeenCalledWith(
        "session-reminder",
        expect.objectContaining({ reminderType: "1H" }),
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });

    it("moves COUNTER_PROPOSED -> ACCEPTED when the student accepts, updating scheduledAt", async () => {
      const proposedScheduledAt = new Date("2026-09-01T09:00:00.000Z");
      const booking = makeBooking({ status: "COUNTER_PROPOSED", proposedScheduledAt });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({
        ...booking,
        status: "ACCEPTED",
        scheduledAt: proposedScheduledAt,
      });

      await service.accept(studentUser, "b1");

      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: { status: "ACCEPTED", scheduledAt: proposedScheduledAt },
        include: expect.anything(),
      });
      expect(notifications.send).toHaveBeenCalledWith(
        "tutor-user-1",
        "BOOKING_ACCEPTED",
        { bookingId: "b1" },
        tx,
      );
    });

    it("rejects a student trying to accept a REQUESTED booking (only the tutor can)", async () => {
      tx.booking.findUnique.mockResolvedValue(makeBooking());
      await expect(service.accept(studentUser, "b1")).rejects.toThrow(BadRequestException);
    });

    it("rejects accepting an already-declined booking", async () => {
      tx.booking.findUnique.mockResolvedValue(makeBooking({ status: "DECLINED" }));
      await expect(service.accept(tutorUser, "b1")).rejects.toThrow(BadRequestException);
    });

    it("rejects a non-participant", async () => {
      tx.booking.findUnique.mockResolvedValue(makeBooking());
      await expect(service.accept(strangerUser, "b1")).rejects.toThrow(ForbiddenException);
    });

    it("throws NotFoundException for a nonexistent booking", async () => {
      tx.booking.findUnique.mockResolvedValue(null);
      await expect(service.accept(tutorUser, "b1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("decline", () => {
    it("moves REQUESTED -> DECLINED with a reason, notifying the student", async () => {
      const booking = makeBooking();
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({
        ...booking,
        status: "DECLINED",
        declineReason: "Bentrok jadwal",
      });

      await service.decline(tutorUser, "b1", { reason: "Bentrok jadwal" });

      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: { status: "DECLINED", declineReason: "Bentrok jadwal" },
        include: expect.anything(),
      });
      expect(tx.bookingStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ reason: "Bentrok jadwal", toStatus: "DECLINED" }),
      });
      expect(notifications.send).toHaveBeenCalledWith(
        "student-user-1",
        "BOOKING_DECLINED",
        { bookingId: "b1" },
        tx,
      );
    });

    it("moves COUNTER_PROPOSED -> DECLINED when the student declines the counter-offer", async () => {
      const booking = makeBooking({ status: "COUNTER_PROPOSED" });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, status: "DECLINED" });

      await service.decline(studentUser, "b1", {});

      expect(notifications.send).toHaveBeenCalledWith(
        "tutor-user-1",
        "BOOKING_DECLINED",
        { bookingId: "b1" },
        tx,
      );
    });

    it("rejects a tutor trying to decline a COUNTER_PROPOSED booking (only the student can)", async () => {
      tx.booking.findUnique.mockResolvedValue(makeBooking({ status: "COUNTER_PROPOSED" }));
      await expect(service.decline(tutorUser, "b1", {})).rejects.toThrow(BadRequestException);
    });
  });

  describe("counterPropose", () => {
    it("moves REQUESTED -> COUNTER_PROPOSED, sets proposedScheduledAt, and re-enqueues expiry", async () => {
      const booking = makeBooking();
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, id: "b1", status: "COUNTER_PROPOSED" });

      const result = await service.counterPropose(tutorUser, "b1", {
        proposedDate: "2026-09-01",
        proposedTime: "16:00",
      });

      expect(result.status).toBe("COUNTER_PROPOSED");
      expect(notifications.send).toHaveBeenCalledWith(
        "student-user-1",
        "BOOKING_COUNTER_PROPOSED",
        expect.objectContaining({ bookingId: "b1" }),
        tx,
      );
      expect(queue.add).toHaveBeenCalledWith(
        "expire-booking",
        { bookingId: "b1" },
        { delay: 24 * 60 * 60 * 1000 },
      );
    });

    it("rejects a student trying to counter-propose", async () => {
      tx.booking.findUnique.mockResolvedValue(makeBooking());
      await expect(
        service.counterPropose(studentUser, "b1", {
          proposedDate: "2026-09-01",
          proposedTime: "16:00",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects proposing a time in the past", async () => {
      tx.booking.findUnique.mockResolvedValue(makeBooking());
      await expect(
        service.counterPropose(tutorUser, "b1", {
          proposedDate: "2020-01-01",
          proposedTime: "16:00",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects counter-proposing a booking that isn't REQUESTED", async () => {
      tx.booking.findUnique.mockResolvedValue(makeBooking({ status: "ACCEPTED" }));
      await expect(
        service.counterPropose(tutorUser, "b1", {
          proposedDate: "2026-09-01",
          proposedTime: "16:00",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("proposeReschedule / respondToReschedule", () => {
    it("moves ACCEPTED -> RESCHEDULE_PROPOSED, notifying the other participant", async () => {
      const booking = makeBooking({ status: "ACCEPTED" });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, status: "RESCHEDULE_PROPOSED" });

      const result = await service.proposeReschedule(tutorUser, "b1", {
        proposedDate: "2026-09-15",
        proposedTime: "17:00",
      });

      expect(result.status).toBe("RESCHEDULE_PROPOSED");
      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: expect.objectContaining({
          status: "RESCHEDULE_PROPOSED",
          rescheduleProposedByUserId: "tutor-user-1",
        }),
        include: expect.anything(),
      });
      expect(notifications.send).toHaveBeenCalledWith(
        "student-user-1",
        "BOOKING_RESCHEDULE_PROPOSED",
        expect.objectContaining({ bookingId: "b1" }),
        tx,
      );
    });

    it("rejects proposing a reschedule on a booking that isn't ACCEPTED", async () => {
      tx.booking.findUnique.mockResolvedValue(makeBooking({ status: "REQUESTED" }));
      await expect(
        service.proposeReschedule(tutorUser, "b1", {
          proposedDate: "2026-09-15",
          proposedTime: "17:00",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects proposing a reschedule time in the past", async () => {
      tx.booking.findUnique.mockResolvedValue(makeBooking({ status: "ACCEPTED" }));
      await expect(
        service.proposeReschedule(tutorUser, "b1", {
          proposedDate: "2020-01-01",
          proposedTime: "17:00",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("lets the other participant accept a reschedule, updating scheduledAt", async () => {
      const proposedScheduledAt = new Date("2026-09-15T10:00:00.000Z");
      const booking = makeBooking({
        status: "RESCHEDULE_PROPOSED",
        proposedScheduledAt,
        rescheduleProposedByUserId: "tutor-user-1",
      });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({
        ...booking,
        status: "ACCEPTED",
        scheduledAt: proposedScheduledAt,
      });

      await service.respondToReschedule(studentUser, "b1", "reschedule-accept");

      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: {
          status: "ACCEPTED",
          proposedScheduledAt: null,
          rescheduleProposedByUserId: null,
          scheduledAt: proposedScheduledAt,
        },
        include: expect.anything(),
      });
      expect(notifications.send).toHaveBeenCalledWith(
        "tutor-user-1",
        "BOOKING_RESCHEDULE_ACCEPTED",
        { bookingId: "b1" },
        tx,
      );
      expect(reminderQueue.add).toHaveBeenCalledTimes(2);
    });

    it("lets the other participant decline a reschedule, keeping the original scheduledAt", async () => {
      const proposedScheduledAt = new Date("2026-09-15T10:00:00.000Z");
      const booking = makeBooking({
        status: "RESCHEDULE_PROPOSED",
        proposedScheduledAt,
        rescheduleProposedByUserId: "tutor-user-1",
      });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, status: "ACCEPTED" });

      await service.respondToReschedule(studentUser, "b1", "reschedule-decline");

      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: { status: "ACCEPTED", proposedScheduledAt: null, rescheduleProposedByUserId: null },
        include: expect.anything(),
      });
      expect(notifications.send).toHaveBeenCalledWith(
        "tutor-user-1",
        "BOOKING_RESCHEDULE_DECLINED",
        { bookingId: "b1" },
        tx,
      );
      expect(reminderQueue.add).not.toHaveBeenCalled();
    });

    it("rejects the proposer trying to respond to their own reschedule proposal", async () => {
      const booking = makeBooking({
        status: "RESCHEDULE_PROPOSED",
        proposedScheduledAt: new Date("2026-09-15T10:00:00.000Z"),
        rescheduleProposedByUserId: "tutor-user-1",
      });
      tx.booking.findUnique.mockResolvedValue(booking);

      await expect(
        service.respondToReschedule(tutorUser, "b1", "reschedule-accept"),
      ).rejects.toThrow(BadRequestException);
      expect(tx.booking.update).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("cancels a REQUESTED booking for free regardless of timing", async () => {
      const booking = makeBooking({
        status: "REQUESTED",
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour away
      });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, status: "CANCELLED" });

      await service.cancel(studentUser, "b1", { reasonCode: "NO_LONGER_NEEDED" });

      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          isLateCancellation: false,
          cancelledByUserId: "student-user-1",
          cancellationReasonCode: "NO_LONGER_NEEDED",
        }),
        include: expect.anything(),
      });
    });

    it("flags an ACCEPTED booking cancelled inside the free window as late", async () => {
      const booking = makeBooking({
        status: "ACCEPTED",
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour away, window is 24h
      });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, status: "CANCELLED" });

      await service.cancel(tutorUser, "b1", { reasonCode: "SCHEDULE_CONFLICT", details: "Sakit" });

      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: expect.objectContaining({ isLateCancellation: true }),
        include: expect.anything(),
      });
    });

    it("does not flag an ACCEPTED booking cancelled outside the free window", async () => {
      const booking = makeBooking({
        status: "ACCEPTED",
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours away
      });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, status: "CANCELLED" });

      await service.cancel(tutorUser, "b1", { reasonCode: "SCHEDULE_CONFLICT" });

      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: expect.objectContaining({ isLateCancellation: false }),
        include: expect.anything(),
      });
    });

    it("rejects cancelling an already-cancelled booking", async () => {
      tx.booking.findUnique.mockResolvedValue(
        makeBooking({ status: "CANCELLED", scheduledAt: new Date() }),
      );
      await expect(
        service.cancel(tutorUser, "b1", { reasonCode: "OTHER" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a non-participant trying to cancel", async () => {
      tx.booking.findUnique.mockResolvedValue(
        makeBooking({ status: "ACCEPTED", scheduledAt: new Date(Date.now() + 60 * 60 * 1000) }),
      );
      await expect(
        service.cancel(strangerUser, "b1", { reasonCode: "OTHER" }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("reportNoShow", () => {
    it("flags an ACCEPTED booking with a scheduledAt in the past as a no-show", async () => {
      const booking = makeBooking({
        status: "ACCEPTED",
        scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
        noShowReported: false,
      });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, noShowReported: true });

      await service.reportNoShow(tutorUser, "b1");

      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: {
          noShowReported: true,
          noShowReportedByUserId: "tutor-user-1",
          noShowReportedAt: expect.any(Date),
        },
        include: expect.anything(),
      });
      expect(notifications.send).toHaveBeenCalledWith(
        "student-user-1",
        "BOOKING_NO_SHOW_REPORTED",
        { bookingId: "b1" },
        tx,
      );
    });

    it("flags a CONFIRMED (paid) booking with a scheduledAt in the past as a no-show", async () => {
      const booking = makeBooking({
        status: "CONFIRMED",
        scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
        noShowReported: false,
      });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, noShowReported: true });

      await service.reportNoShow(tutorUser, "b1");

      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: {
          noShowReported: true,
          noShowReportedByUserId: "tutor-user-1",
          noShowReportedAt: expect.any(Date),
        },
        include: expect.anything(),
      });
    });

    it("rejects reporting a no-show before the session time has passed", async () => {
      tx.booking.findUnique.mockResolvedValue(
        makeBooking({ status: "ACCEPTED", scheduledAt: new Date(Date.now() + 60 * 60 * 1000) }),
      );
      await expect(service.reportNoShow(tutorUser, "b1")).rejects.toThrow(BadRequestException);
    });

    it("rejects reporting a no-show on a booking that was never accepted", async () => {
      tx.booking.findUnique.mockResolvedValue(
        makeBooking({ status: "REQUESTED", scheduledAt: new Date(Date.now() - 60 * 60 * 1000) }),
      );
      await expect(service.reportNoShow(tutorUser, "b1")).rejects.toThrow(BadRequestException);
    });

    it("rejects reporting a no-show twice", async () => {
      tx.booking.findUnique.mockResolvedValue(
        makeBooking({
          status: "ACCEPTED",
          scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
          noShowReported: true,
        }),
      );
      await expect(service.reportNoShow(tutorUser, "b1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("complete", () => {
    it("moves CONFIRMED -> COMPLETED once the session end time has passed, prompting the student to review", async () => {
      const booking = makeBooking({
        status: "CONFIRMED",
        durationMinutes: 60,
        scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      });
      tx.booking.findUnique.mockResolvedValue(booking);
      tx.booking.update.mockResolvedValue({ ...booking, status: "COMPLETED" });

      const result = await service.complete(tutorUser, "b1");

      expect(result.status).toBe("COMPLETED");
      expect(tx.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: { status: "COMPLETED", completedAt: expect.any(Date), completedByUserId: "tutor-user-1" },
        include: expect.anything(),
      });
      expect(notifications.send).toHaveBeenCalledWith(
        "student-user-1",
        "REVIEW_PROMPT",
        { bookingId: "b1" },
        tx,
      );
    });

    it("rejects a student trying to mark a session complete", async () => {
      tx.booking.findUnique.mockResolvedValue(
        makeBooking({
          status: "CONFIRMED",
          durationMinutes: 60,
          scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        }),
      );
      await expect(service.complete(studentUser, "b1")).rejects.toThrow(ForbiddenException);
    });

    it("rejects completing a booking that isn't CONFIRMED", async () => {
      tx.booking.findUnique.mockResolvedValue(
        makeBooking({
          status: "ACCEPTED",
          durationMinutes: 60,
          scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        }),
      );
      await expect(service.complete(tutorUser, "b1")).rejects.toThrow(BadRequestException);
    });

    it("rejects completing a session before its scheduled end time has passed", async () => {
      tx.booking.findUnique.mockResolvedValue(
        makeBooking({
          status: "CONFIRMED",
          durationMinutes: 60,
          scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
        }),
      );
      await expect(service.complete(tutorUser, "b1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("addNotes", () => {
    it("lets the tutor add notes to a COMPLETED booking", async () => {
      const booking = makeBooking({ status: "COMPLETED" });
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.booking.update.mockResolvedValue({ ...booking, sessionNotes: "Membahas aljabar" });

      const result = await service.addNotes(tutorUser, "b1", { notes: "Membahas aljabar" });

      expect(result.sessionNotes).toBe("Membahas aljabar");
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: { sessionNotes: "Membahas aljabar", sessionNotesUpdatedAt: expect.any(Date) },
        include: expect.anything(),
      });
    });

    it("rejects a student trying to add notes", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
      await expect(
        service.addNotes(studentUser, "b1", { notes: "sneaky" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lets the tutor add notes to a CONFIRMED booking after the session has ended", async () => {
      const booking = makeBooking({
        status: "CONFIRMED",
        durationMinutes: 60,
        scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      });
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.booking.update.mockResolvedValue({ ...booking, sessionNotes: "Membahas aljabar" });

      const result = await service.addNotes(tutorUser, "b1", { notes: "Membahas aljabar" });

      expect(result.sessionNotes).toBe("Membahas aljabar");
    });

    it("rejects adding notes to a CONFIRMED booking before the session has ended", async () => {
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({
          status: "CONFIRMED",
          durationMinutes: 60,
          scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
        }),
      );
      await expect(
        service.addNotes(tutorUser, "b1", { notes: "too soon" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("lets the tutor add notes immediately to a tutor-initiated CONFIRMED booking, before the session has happened", async () => {
      const booking = makeBooking({
        status: "CONFIRMED",
        durationMinutes: 60,
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
        requestedByUserId: "tutor-user-1",
      });
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.booking.update.mockResolvedValue({ ...booking, sessionNotes: "Rencana sesi" });

      const result = await service.addNotes(tutorUser, "b1", { notes: "Rencana sesi" });

      expect(result.sessionNotes).toBe("Rencana sesi");
    });

    it("still requires the session to have ended for a student-initiated CONFIRMED booking, even with requestedByUserId set", async () => {
      prisma.booking.findUnique.mockResolvedValue(
        makeBooking({
          status: "CONFIRMED",
          durationMinutes: 60,
          scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
          requestedByUserId: "student-user-1",
        }),
      );
      await expect(
        service.addNotes(tutorUser, "b1", { notes: "too soon" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects adding notes to a booking that isn't COMPLETED or ended CONFIRMED", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "ACCEPTED" }));
      await expect(
        service.addNotes(tutorUser, "b1", { notes: "too soon" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("session-report attachments", () => {
    function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
      return {
        buffer: Buffer.from("fake"),
        originalname: "worksheet.png",
        mimetype: "image/png",
        size: 1024,
        ...overrides,
      } as Express.Multer.File;
    }

    describe("uploadImage", () => {
      it("lets the tutor upload an inline image", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        prisma.bookingAttachment.create.mockResolvedValue({ id: "att1" });

        const result = await service.uploadImage(tutorUser, "b1", makeFile());

        expect(result).toEqual({ id: "att1" });
        expect(storage.save).toHaveBeenCalled();
        expect(prisma.bookingAttachment.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ kind: "INLINE_IMAGE", bookingId: "b1" }),
          }),
        );
      });

      it("rejects a student trying to upload an image", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        await expect(service.uploadImage(studentUser, "b1", makeFile())).rejects.toThrow(
          ForbiddenException,
        );
      });

      it("rejects an unsupported mime type", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        await expect(
          service.uploadImage(tutorUser, "b1", makeFile({ mimetype: "application/pdf" })),
        ).rejects.toThrow(BadRequestException);
      });

      it("rejects a file over the size cap", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        await expect(
          service.uploadImage(tutorUser, "b1", makeFile({ size: 6 * 1024 * 1024 })),
        ).rejects.toThrow(BadRequestException);
      });

      it("404s for a nonexistent booking", async () => {
        prisma.booking.findUnique.mockResolvedValue(null);
        await expect(service.uploadImage(tutorUser, "nope", makeFile())).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe("uploadDocument", () => {
      it("lets the tutor upload a document", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        prisma.bookingAttachment.create.mockResolvedValue({
          id: "att2",
          filename: "report.pdf",
        });

        const result = await service.uploadDocument(
          tutorUser,
          "b1",
          makeFile({ originalname: "report.pdf", mimetype: "application/pdf" }),
        );

        expect(result).toEqual({ id: "att2", filename: "report.pdf" });
        expect(prisma.bookingAttachment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ kind: "DOCUMENT" }) }),
        );
      });

      it("rejects a student trying to upload a document", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        await expect(
          service.uploadDocument(studentUser, "b1", makeFile({ mimetype: "application/pdf" })),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe("listAttachments", () => {
      it("lets either participant list document attachments", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        prisma.bookingAttachment.findMany.mockResolvedValue([{ id: "att2" }]);

        const result = await service.listAttachments(studentUser, "b1");

        expect(result).toEqual([{ id: "att2" }]);
        expect(prisma.bookingAttachment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { bookingId: "b1", kind: "DOCUMENT" } }),
        );
      });

      it("rejects a non-participant", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        await expect(service.listAttachments(strangerUser, "b1")).rejects.toThrow(
          ForbiddenException,
        );
      });
    });

    describe("getAttachmentFile", () => {
      it("returns bytes for either participant", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        prisma.bookingAttachment.findUnique.mockResolvedValue({
          id: "att2",
          bookingId: "b1",
          mimeType: "application/pdf",
          filename: "report.pdf",
          storagePath: "booking-attachments/b1/xyz.pdf",
        });
        storage.read.mockResolvedValue(Buffer.from("bytes"));

        const result = await service.getAttachmentFile(studentUser, "b1", "att2");

        expect(result).toEqual({
          buffer: Buffer.from("bytes"),
          mimeType: "application/pdf",
          filename: "report.pdf",
        });
      });

      it("404s when the attachment belongs to a different booking", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        prisma.bookingAttachment.findUnique.mockResolvedValue({
          id: "att2",
          bookingId: "some-other-booking",
        });
        await expect(service.getAttachmentFile(studentUser, "b1", "att2")).rejects.toThrow(
          NotFoundException,
        );
      });

      it("rejects a non-participant", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        await expect(
          service.getAttachmentFile(strangerUser, "b1", "att2"),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe("deleteAttachment", () => {
      it("lets the tutor delete an attachment", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        prisma.bookingAttachment.findUnique.mockResolvedValue({ id: "att2", bookingId: "b1" });

        const result = await service.deleteAttachment(tutorUser, "b1", "att2");

        expect(result).toEqual({ ok: true });
        expect(prisma.bookingAttachment.delete).toHaveBeenCalledWith({ where: { id: "att2" } });
      });

      it("rejects a student trying to delete an attachment", async () => {
        prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
        prisma.bookingAttachment.findUnique.mockResolvedValue({ id: "att2", bookingId: "b1" });

        await expect(service.deleteAttachment(studentUser, "b1", "att2")).rejects.toThrow(
          ForbiddenException,
        );
      });
    });
  });

  describe("setMeetingInfo", () => {
    it("sets a valid Zoom link for an ONLINE booking", async () => {
      const booking = makeBooking({ mode: "ONLINE" });
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.booking.update.mockResolvedValue({
        ...booking,
        meetingLink: "https://zoom.us/j/123456789",
      });

      const result = await service.setMeetingInfo(tutorUser, "b1", {
        meetingLink: "https://zoom.us/j/123456789",
      });

      expect(result.meetingLink).toBe("https://zoom.us/j/123456789");
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: {
          meetingLink: "https://zoom.us/j/123456789",
          meetingAddress: null,
          meetingSetByUserId: "tutor-user-1",
          meetingSetAt: expect.any(Date),
        },
        include: expect.anything(),
      });
    });

    it("sets a valid Google Meet link for an ONLINE booking", async () => {
      const booking = makeBooking({ mode: "ONLINE" });
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.booking.update.mockResolvedValue({
        ...booking,
        meetingLink: "https://meet.google.com/abc-defg-hij",
      });

      await service.setMeetingInfo(studentUser, "b1", {
        meetingLink: "https://meet.google.com/abc-defg-hij",
      });

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ meetingLink: "https://meet.google.com/abc-defg-hij" }),
        }),
      );
    });

    it("rejects a non-Zoom/Meet URL for an ONLINE booking", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ mode: "ONLINE" }));
      await expect(
        service.setMeetingInfo(tutorUser, "b1", { meetingLink: "https://evil.example.com/join" }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it("rejects a missing meetingLink for an ONLINE booking", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ mode: "ONLINE" }));
      await expect(service.setMeetingInfo(tutorUser, "b1", {})).rejects.toThrow(BadRequestException);
    });

    it("sets a meeting address for an OFFLINE booking", async () => {
      const booking = makeBooking({ mode: "OFFLINE" });
      prisma.booking.findUnique.mockResolvedValue(booking);
      prisma.booking.update.mockResolvedValue({
        ...booking,
        meetingAddress: "Jl. Sudirman No. 1, Jakarta",
      });

      const result = await service.setMeetingInfo(tutorUser, "b1", {
        meetingAddress: "Jl. Sudirman No. 1, Jakarta",
      });

      expect(result.meetingAddress).toBe("Jl. Sudirman No. 1, Jakarta");
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: "b1" },
        data: {
          meetingLink: null,
          meetingAddress: "Jl. Sudirman No. 1, Jakarta",
          meetingSetByUserId: "tutor-user-1",
          meetingSetAt: expect.any(Date),
        },
        include: expect.anything(),
      });
    });

    it("rejects an empty meetingAddress for an OFFLINE booking", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ mode: "OFFLINE" }));
      await expect(
        service.setMeetingInfo(tutorUser, "b1", { meetingAddress: "   " }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a non-participant", async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ mode: "ONLINE" }));
      await expect(
        service.setMeetingInfo(strangerUser, "b1", { meetingLink: "https://zoom.us/j/123" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws NotFoundException for a nonexistent booking", async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(
        service.setMeetingInfo(tutorUser, "b1", { meetingLink: "https://zoom.us/j/123" }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

describe("BookingsService.editForTutor", () => {
  interface EditTx {
    $executeRaw: jest.Mock;
    booking: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    tutoringPackage: { findUnique: jest.Mock };
    subject: { findUnique: jest.Mock };
  }

  let prisma: { $transaction: jest.Mock };
  let notifications: { send: jest.Mock };
  let chat: { createChannelForBooking: jest.Mock };
  let payments: { schedulePaymentExpiry: jest.Mock };
  let storage: { save: jest.Mock; read: jest.Mock };
  let queue: { add: jest.Mock };
  let reminderQueue: { add: jest.Mock };
  let service: BookingsService;
  let tx: EditTx;

  const tutorUser = makeUser({ id: "tutor-user-1", role: "TUTOR" });
  const studentUser = makeUser({ id: "student-user-1", role: "STUDENT" });

  function makeBooking(overrides: Record<string, unknown> = {}) {
    return {
      id: "b1",
      status: "CONFIRMED",
      requestedByUserId: "tutor-user-1",
      scheduledAt: new Date("2030-08-18T03:00:00.000Z"),
      durationMinutes: 60,
      priceAmount: 100000,
      mode: "ONLINE",
      notes: null,
      subjectId: "s1",
      packageId: null,
      tutorId: "tp1",
      student: { userId: "student-user-1" },
      tutor: { userId: "tutor-user-1", city: "Jakarta Selatan", hourlyRate: 100000 },
      ...overrides,
    };
  }

  beforeEach(() => {
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      booking: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      tutoringPackage: { findUnique: jest.fn() },
      subject: { findUnique: jest.fn() },
    };
    prisma = { $transaction: jest.fn((cb: (tx: EditTx) => unknown) => cb(tx)) };
    notifications = { send: jest.fn().mockResolvedValue({}) };
    chat = { createChannelForBooking: jest.fn().mockResolvedValue(undefined) };
    payments = { schedulePaymentExpiry: jest.fn().mockResolvedValue(undefined) };
    storage = { save: jest.fn().mockResolvedValue("path"), read: jest.fn() };
    queue = { add: jest.fn() };
    reminderQueue = { add: jest.fn() };
    service = new BookingsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      chat as unknown as ChatService,
      payments as unknown as PaymentsService,
      storage as unknown as StorageService,
      queue as unknown as Queue,
      reminderQueue as unknown as Queue,
    );
  });

  it("edits time and duration, recomputing the price and notifying the student", async () => {
    const booking = makeBooking();
    tx.booking.findUnique.mockResolvedValue(booking);
    tx.booking.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...booking, ...data }),
    );

    const result = await service.editForTutor(tutorUser, "b1", {
      scheduledDate: "2030-08-20",
      startTime: "14:00",
      durationMinutes: 90,
    });

    expect(tx.booking.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: {
        scheduledAt: expect.any(Date),
        durationMinutes: 90,
        subjectId: "s1",
        mode: "ONLINE",
        notes: null,
        priceAmount: 150000, // 100000 * 90 / 60
      },
      include: expect.anything(),
    });
    expect(result.durationMinutes).toBe(90);
    expect(notifications.send).toHaveBeenCalledWith(
      "student-user-1",
      "SESSION_EDITED",
      { bookingId: "b1" },
      tx,
    );
  });

  it("rejects editing a booking the student originally requested", async () => {
    const booking = makeBooking({ requestedByUserId: "student-user-1" });
    tx.booking.findUnique.mockResolvedValue(booking);

    await expect(
      service.editForTutor(tutorUser, "b1", { notes: "updated" }),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it("rejects editing a booking that isn't CONFIRMED", async () => {
    const booking = makeBooking({ status: "ACCEPTED" });
    tx.booking.findUnique.mockResolvedValue(booking);

    await expect(
      service.editForTutor(tutorUser, "b1", { notes: "updated" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects editing a session that has already started", async () => {
    const booking = makeBooking({ scheduledAt: new Date(Date.now() - 60 * 60 * 1000) });
    tx.booking.findUnique.mockResolvedValue(booking);

    await expect(
      service.editForTutor(tutorUser, "b1", { notes: "updated" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects a student calling editForTutor", async () => {
    tx.booking.findUnique.mockResolvedValue(makeBooking());

    await expect(
      service.editForTutor(studentUser, "b1", { notes: "updated" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects a new time that overlaps another active booking for the same tutor", async () => {
    const booking = makeBooking();
    tx.booking.findUnique.mockResolvedValue(booking);
    tx.booking.findMany.mockResolvedValue([
      { scheduledAt: new Date("2030-08-20T07:15:00.000Z"), durationMinutes: 60 },
    ]);

    await expect(
      service.editForTutor(tutorUser, "b1", {
        scheduledDate: "2030-08-20",
        startTime: "14:00",
        durationMinutes: 60,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it("rejects a duration that doesn't match the booking's fixed-price package", async () => {
    const booking = makeBooking({ packageId: "pkg1" });
    tx.booking.findUnique.mockResolvedValue(booking);
    tx.tutoringPackage.findUnique.mockResolvedValue({
      id: "pkg1",
      durationMinutes: 60,
      sessionCount: 4,
      totalPrice: 400000,
      isActive: true,
    });

    await expect(
      service.editForTutor(tutorUser, "b1", { durationMinutes: 90 }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it("does not overwrite a package-derived price when duration is unchanged", async () => {
    const booking = makeBooking({ packageId: "pkg1", priceAmount: 100000 });
    tx.booking.findUnique.mockResolvedValue(booking);
    tx.tutoringPackage.findUnique.mockResolvedValue({
      id: "pkg1",
      durationMinutes: 60,
      sessionCount: 4,
      totalPrice: 400000,
      isActive: true,
    });
    tx.booking.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...booking, ...data }),
    );

    await service.editForTutor(tutorUser, "b1", { notes: "Bawa buku catatan" });

    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priceAmount: 100000 }) }),
    );
  });
});
