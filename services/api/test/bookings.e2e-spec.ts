import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseAdminService } from "../src/auth/firebase-admin.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { BOOKING_EXPIRY_QUEUE, SESSION_REMINDER_QUEUE } from "../src/jobs/jobs.module";
import { BookingExpiryProcessor } from "../src/bookings/processors/booking-expiry.processor";
import { SessionReminderProcessor } from "../src/bookings/processors/session-reminder.processor";

// The real HTTP-level transaction/row-locking behavior is what's worth
// verifying here (especially the concurrency test) - real Postgres, but
// the BullMQ queue is mocked so tests don't spin up real delayed jobs.
describe("Bookings (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const verifyIdToken = jest.fn();
  const queueAdd = jest.fn().mockResolvedValue(undefined);
  const reminderQueueAdd = jest.fn().mockResolvedValue(undefined);
  const auth = ["Authorization", "Bearer good-token"] as const;

  let tutorProfileId: string;
  let subjectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseAdminService)
      .useValue({ verifyIdToken })
      .overrideProvider(getQueueToken(BOOKING_EXPIRY_QUEUE))
      .useValue({ add: queueAdd })
      .overrideProvider(getQueueToken(SESSION_REMINDER_QUEUE))
      .useValue({ add: reminderQueueAdd })
      // Prevents real BullMQ Workers (with their own blocking Redis
      // connections) from starting during app.init() - each processor's
      // logic is unit-tested separately. Overriding a queue token without
      // also overriding its @Processor breaks that processor's Worker
      // (it can no longer resolve connection options from the now-fake
      // queue token), so the two always go together.
      .overrideProvider(BookingExpiryProcessor)
      .useValue({})
      .overrideProvider(SessionReminderProcessor)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleFixture.get(PrismaService);

    const subject = await prisma.subject.upsert({
      where: { name: "Matematika" },
      update: {},
      create: { name: "Matematika" },
    });
    subjectId = subject.id;

    const tutorUser = await prisma.user.create({
      data: { firebaseUid: "e2e-bookings-tutor-1", role: "TUTOR", phone: "+6281234590001" },
    });
    const tutorProfile = await prisma.tutorProfile.create({
      data: {
        userId: tutorUser.id,
        city: "Jakarta Selatan",
        verificationStatus: "VERIFIED",
        teachingModes: ["ONLINE"],
        hourlyRate: 100000,
      },
    });
    tutorProfileId = tutorProfile.id;
  });

  afterAll(async () => {
    // Deletion order matters - Booking references StudentProfile, which
    // references User, so those FKs have to be cleared innermost-first.
    // BookingStatusHistory/Notification/Conversation rows (the latter
    // written by every real POST /bookings call now that Task 4.1 creates
    // a chat thread per booking) reference Booking/User with ON DELETE
    // RESTRICT, so they must go before their parents do.
    await prisma.bookingStatusHistory.deleteMany({ where: { booking: { tutorId: tutorProfileId } } });
    await prisma.conversation.deleteMany({ where: { booking: { tutorId: tutorProfileId } } });
    await prisma.notification.deleteMany({
      where: {
        user: {
          OR: [
            { firebaseUid: "e2e-bookings-tutor-1" },
            { firebaseUid: { startsWith: "e2e-bookings-student" } },
          ],
        },
      },
    });
    await prisma.booking.deleteMany({ where: { tutorId: tutorProfileId } });
    await prisma.tutorProfile.deleteMany({ where: { id: tutorProfileId } });
    await prisma.user.deleteMany({ where: { firebaseUid: "e2e-bookings-tutor-1" } });
    await prisma.studentProfile.deleteMany({
      where: { user: { firebaseUid: { startsWith: "e2e-bookings-student" } } },
    });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: "e2e-bookings-student" } } });
    await app.close();
  });

  async function createStudent(firebaseUid: string) {
    const user = await prisma.user.create({
      data: { firebaseUid, role: "STUDENT", phone: `+62812345${Math.floor(Math.random() * 100000)}` },
    });
    const profile = await prisma.studentProfile.create({ data: { userId: user.id } });
    return { user, profile };
  }

  it("returns 400 for a TUTOR creating a booking without studentId", async () => {
    const tutorUser = await prisma.user.findUniqueOrThrow({
      where: { firebaseUid: "e2e-bookings-tutor-1" },
    });
    verifyIdToken.mockResolvedValue({ uid: tutorUser.firebaseUid });
    await request(app.getHttpServer())
      .post("/api/bookings")
      .set(...auth)
      .send({
        tutorId: tutorProfileId,
        startTime: "16:00",
        subjectId,
        scheduledDate: "2026-08-18",
        durationMinutes: 60,
        mode: "ONLINE",
      })
      .expect(400);
  });

  it("lets a TUTOR create a booking for a specific student (studentId instead of tutorId) with no approval needed, notifying the student", async () => {
    const tutorUser = await prisma.user.findUniqueOrThrow({
      where: { firebaseUid: "e2e-bookings-tutor-1" },
    });
    const { user: studentUser, profile } = await createStudent("e2e-bookings-student-tutor-init");
    verifyIdToken.mockResolvedValue({ uid: tutorUser.firebaseUid });

    const res = await request(app.getHttpServer())
      .post("/api/bookings")
      .set(...auth)
      .send({
        studentId: profile.id,
        startTime: "16:00",
        subjectId,
        scheduledDate: "2026-11-17", // another Tuesday, unused elsewhere in this file
        durationMinutes: 60,
        mode: "ONLINE",
      })
      .expect(201);

    // Confirmed immediately - no student approval step and no payment
    // step for a tutor-initiated booking.
    expect(res.body.status).toBe("CONFIRMED");
    expect(res.body.respondByAt).toBeNull();
    expect(res.body.requestedByUserId).toBe(tutorUser.id);

    const studentNotification = await prisma.notification.findFirst({
      where: { userId: studentUser.id, type: "BOOKING_ACCEPTED" },
    });
    expect(studentNotification).not.toBeNull();
  });

  it("creates a REQUESTED booking with the correct UTC scheduledAt and enqueues an expiry job", async () => {
    const { user } = await createStudent("e2e-bookings-student-1");
    verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

    const res = await request(app.getHttpServer())
      .post("/api/bookings")
      .set(...auth)
      .send({
        tutorId: tutorProfileId,
        startTime: "16:00",
        subjectId,
        scheduledDate: "2026-08-18", // a Tuesday
        durationMinutes: 60,
        mode: "ONLINE",
        notes: "Fokus ke aljabar",
      })
      .expect(201);

    expect(res.body.status).toBe("REQUESTED");
    // 16:00 WIB (UTC+7) = 09:00 UTC.
    expect(res.body.scheduledAt).toBe("2026-08-18T09:00:00.000Z");
    expect(res.body.notes).toBe("Fokus ke aljabar");
    expect(queueAdd).toHaveBeenCalledWith(
      "expire-booking",
      { bookingId: res.body.id },
      { delay: 24 * 60 * 60 * 1000 },
    );

    // BookingStatusHistory/Conversation (written by create()) reference
    // this booking with ON DELETE RESTRICT, so they have to go first.
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: res.body.id } });
    await prisma.conversation.deleteMany({ where: { bookingId: res.body.id } });
    await prisma.booking.delete({ where: { id: res.body.id } });
  });

  it("rejects booking a date in the past", async () => {
    const { user } = await createStudent("e2e-bookings-student-3");
    verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

    await request(app.getHttpServer())
      .post("/api/bookings")
      .set(...auth)
      .send({
        tutorId: tutorProfileId,
        startTime: "16:00",
        subjectId,
        scheduledDate: "2020-08-18", // a Tuesday, but in the past
        durationMinutes: 60,
        mode: "ONLINE",
      })
      .expect(400);
  });

  it("rejects a mode the tutor doesn't offer", async () => {
    const { user } = await createStudent("e2e-bookings-student-4");
    verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

    await request(app.getHttpServer())
      .post("/api/bookings")
      .set(...auth)
      .send({
        tutorId: tutorProfileId,
        startTime: "16:00",
        subjectId,
        scheduledDate: "2026-08-18",
        durationMinutes: 60,
        mode: "OFFLINE", // tutor only offers ONLINE
      })
      .expect(400);
  });

  it("rejects an invalid duration", async () => {
    const { user } = await createStudent("e2e-bookings-student-5");
    verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

    await request(app.getHttpServer())
      .post("/api/bookings")
      .set(...auth)
      .send({
        tutorId: tutorProfileId,
        startTime: "16:00",
        subjectId,
        scheduledDate: "2026-08-18",
        durationMinutes: 45,
        mode: "ONLINE",
      })
      .expect(400);
  });

  it("rejects a startTime that isn't half-hour-aligned", async () => {
    const { user } = await createStudent("e2e-bookings-student-5b");
    verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

    await request(app.getHttpServer())
      .post("/api/bookings")
      .set(...auth)
      .send({
        tutorId: tutorProfileId,
        startTime: "16:15",
        subjectId,
        scheduledDate: "2026-08-18",
        durationMinutes: 60,
        mode: "ONLINE",
      })
      .expect(400);
  });

  it("prevents two concurrent requests from double-booking the exact same time", async () => {
    const [a, b] = await Promise.all([
      createStudent("e2e-bookings-student-race-a"),
      createStudent("e2e-bookings-student-race-b"),
    ]);

    const payload = {
      tutorId: tutorProfileId,
      startTime: "16:00",
      subjectId,
      scheduledDate: "2026-08-25", // another Tuesday
      durationMinutes: 60,
      mode: "ONLINE",
    };

    const fireAs = (firebaseUid: string) => {
      verifyIdToken.mockImplementation(async () => ({ uid: firebaseUid }));
      return request(app.getHttpServer()).post("/api/bookings").set(...auth).send(payload);
    };

    const [resA, resB] = await Promise.all([
      fireAs(a.user.firebaseUid!),
      fireAs(b.user.firebaseUid!),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 400]);

    const bookingsForTime = await prisma.booking.count({
      where: { tutorId: tutorProfileId, scheduledAt: new Date("2026-08-25T09:00:00.000Z") },
    });
    expect(bookingsForTime).toBe(1);
  });

  // Proves the advisory-lock + overlap-check mechanism specifically (not
  // just an exact-time collision, which two independent unique-ish
  // scheduledAt values could plausibly pass even with a weaker check) -
  // 16:00-17:00 and 16:30-17:30 overlap by 30 minutes but aren't identical.
  it("prevents two concurrent requests from double-booking overlapping (not identical) times", async () => {
    const [a, b] = await Promise.all([
      createStudent("e2e-bookings-student-race-overlap-a"),
      createStudent("e2e-bookings-student-race-overlap-b"),
    ]);

    const fireAs = (firebaseUid: string, startTime: string) => {
      verifyIdToken.mockImplementation(async () => ({ uid: firebaseUid }));
      return request(app.getHttpServer())
        .post("/api/bookings")
        .set(...auth)
        .send({
          tutorId: tutorProfileId,
          startTime,
          subjectId,
          scheduledDate: "2026-08-25", // same Tuesday as the exact-match race above
          durationMinutes: 60,
          mode: "ONLINE",
        });
    };

    const [resA, resB] = await Promise.all([
      fireAs(a.user.firebaseUid!, "18:00"),
      fireAs(b.user.firebaseUid!, "18:30"),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 400]);
  });

  it("GET /bookings/:id returns 403 for a non-participant", async () => {
    const { user: owner } = await createStudent("e2e-bookings-student-owner");
    verifyIdToken.mockResolvedValue({ uid: owner.firebaseUid });
    const created = await request(app.getHttpServer())
      .post("/api/bookings")
      .set(...auth)
      .send({
        tutorId: tutorProfileId,
        startTime: "16:00",
        subjectId,
        scheduledDate: "2026-09-01", // another Tuesday
        durationMinutes: 60,
        mode: "ONLINE",
      })
      .expect(201);

    const { user: stranger } = await createStudent("e2e-bookings-student-stranger");
    verifyIdToken.mockResolvedValue({ uid: stranger.firebaseUid });
    await request(app.getHttpServer())
      .get(`/api/bookings/${created.body.id}`)
      .set(...auth)
      .expect(403);

    verifyIdToken.mockResolvedValue({ uid: owner.firebaseUid });
    await request(app.getHttpServer())
      .get(`/api/bookings/${created.body.id}`)
      .set(...auth)
      .expect(200);
  });

  it("GET /bookings scopes results to the current user's role", async () => {
    const { user } = await createStudent("e2e-bookings-student-scope");
    verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

    const res = await request(app.getHttpServer())
      .get("/api/bookings")
      .set(...auth)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(
      res.body.data.every((b: { student: { userId: string } }) => b.student.userId === user.id),
    ).toBe(true);
  });

  describe("upcoming/past/cancelled buckets and pagination", () => {
    it("buckets a REQUESTED future booking as upcoming, not past or cancelled", async () => {
      const { user, profile } = await createStudent("e2e-bookings-student-bucket-upcoming");
      const booking = await prisma.booking.create({
        data: {
          studentId: profile.id,
          tutorId: tutorProfileId,
          subjectId,
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          durationMinutes: 60,
          mode: "ONLINE",
          status: "REQUESTED",
        },
      });
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      const upcoming = await request(app.getHttpServer())
        .get("/api/bookings?bucket=upcoming")
        .set(...auth)
        .expect(200);
      expect(upcoming.body.data.some((b: { id: string }) => b.id === booking.id)).toBe(true);

      const past = await request(app.getHttpServer())
        .get("/api/bookings?bucket=past")
        .set(...auth)
        .expect(200);
      expect(past.body.data.some((b: { id: string }) => b.id === booking.id)).toBe(false);

      const cancelled = await request(app.getHttpServer())
        .get("/api/bookings?bucket=cancelled")
        .set(...auth)
        .expect(200);
      expect(cancelled.body.data.some((b: { id: string }) => b.id === booking.id)).toBe(false);
    });

    it("buckets an ACCEPTED booking with a scheduledAt in the past as past, not upcoming", async () => {
      const { user, profile } = await createStudent("e2e-bookings-student-bucket-past");
      const booking = await prisma.booking.create({
        data: {
          studentId: profile.id,
          tutorId: tutorProfileId,
          subjectId,
          scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          durationMinutes: 60,
          mode: "ONLINE",
          status: "ACCEPTED",
        },
      });
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      const past = await request(app.getHttpServer())
        .get("/api/bookings?bucket=past")
        .set(...auth)
        .expect(200);
      expect(past.body.data.some((b: { id: string }) => b.id === booking.id)).toBe(true);

      const upcoming = await request(app.getHttpServer())
        .get("/api/bookings?bucket=upcoming")
        .set(...auth)
        .expect(200);
      expect(upcoming.body.data.some((b: { id: string }) => b.id === booking.id)).toBe(false);
    });

    it("buckets DECLINED/EXPIRED/CANCELLED bookings as cancelled regardless of date", async () => {
      const { user, profile } = await createStudent("e2e-bookings-student-bucket-cancelled");
      const booking = await prisma.booking.create({
        data: {
          studentId: profile.id,
          tutorId: tutorProfileId,
          subjectId,
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          durationMinutes: 60,
          mode: "ONLINE",
          status: "DECLINED",
        },
      });
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      const cancelled = await request(app.getHttpServer())
        .get("/api/bookings?bucket=cancelled")
        .set(...auth)
        .expect(200);
      expect(cancelled.body.data.some((b: { id: string }) => b.id === booking.id)).toBe(true);

      const upcoming = await request(app.getHttpServer())
        .get("/api/bookings?bucket=upcoming")
        .set(...auth)
        .expect(200);
      expect(upcoming.body.data.some((b: { id: string }) => b.id === booking.id)).toBe(false);
    });

    it("paginates with limit/page and reports an accurate total", async () => {
      const { user, profile } = await createStudent("e2e-bookings-student-pagination");
      for (let i = 0; i < 3; i++) {
        await prisma.booking.create({
          data: {
            studentId: profile.id,
            tutorId: tutorProfileId,
            subjectId,
            scheduledAt: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
            durationMinutes: 60,
            mode: "ONLINE",
            status: "REQUESTED",
          },
        });
      }
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      const res = await request(app.getHttpServer())
        .get("/api/bookings?limit=2&page=1")
        .set(...auth)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(3);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
    });
  });

  describe("accept / decline / counter-propose", () => {
    async function tutorAuth() {
      const tutorUser = await prisma.user.findUniqueOrThrow({
        where: { firebaseUid: "e2e-bookings-tutor-1" },
      });
      verifyIdToken.mockResolvedValue({ uid: tutorUser.firebaseUid });
      return tutorUser;
    }

    async function createRequestedBooking(firebaseUid: string, scheduledAt: string) {
      const { user, profile } = await createStudent(firebaseUid);
      const booking = await prisma.booking.create({
        data: {
          studentId: profile.id,
          tutorId: tutorProfileId,
          subjectId,
          scheduledAt: new Date(scheduledAt),
          durationMinutes: 60,
          mode: "ONLINE",
          status: "REQUESTED",
          respondByAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return { user, booking };
    }

    it("creating a booking notifies the tutor and logs a REQUESTED history entry", async () => {
      const { user } = await createStudent("e2e-bookings-student-notify-create");
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      const res = await request(app.getHttpServer())
        .post("/api/bookings")
        .set(...auth)
        .send({
          tutorId: tutorProfileId,
          startTime: "16:00",
          subjectId,
          scheduledDate: "2026-10-06", // a Tuesday
          durationMinutes: 60,
          mode: "ONLINE",
        })
        .expect(201);

      const tutorUser = await prisma.user.findUniqueOrThrow({
        where: { firebaseUid: "e2e-bookings-tutor-1" },
      });
      const notification = await prisma.notification.findFirst({
        where: { userId: tutorUser.id, type: "BOOKING_REQUESTED" },
      });
      expect(notification).not.toBeNull();

      const history = await prisma.bookingStatusHistory.findMany({
        where: { bookingId: res.body.id },
      });
      expect(history).toHaveLength(1);
      expect(history[0].fromStatus).toBeNull();
      expect(history[0].toStatus).toBe("REQUESTED");
      // Left in place for afterAll's bulk cleanup - it now has a
      // BookingStatusHistory row referencing it (ON DELETE RESTRICT).
    });

    it("tutor accepts a REQUESTED booking, notifying the student and logging history", async () => {
      const { user, booking } = await createRequestedBooking(
        "e2e-bookings-student-accept",
        "2026-08-18T09:00:00.000Z",
      );
      const tutorUser = await tutorAuth();

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/accept`)
        .set(...auth)
        .expect(200);

      expect(res.body.status).toBe("ACCEPTED");

      const notification = await prisma.notification.findFirst({
        where: { userId: user.id, type: "BOOKING_ACCEPTED" },
      });
      expect(notification).not.toBeNull();
      expect((notification!.data as { bookingId: string }).bookingId).toBe(booking.id);

      const history = await prisma.bookingStatusHistory.findMany({
        where: { bookingId: booking.id },
      });
      expect(history).toHaveLength(1);
      expect(history[0].toStatus).toBe("ACCEPTED");
      expect(history[0].changedByUserId).toBe(tutorUser.id);

      // Accepting schedules both the 24h and 1h session reminders (Task 3.6).
      expect(reminderQueueAdd).toHaveBeenCalledWith(
        "session-reminder",
        expect.objectContaining({ bookingId: booking.id, reminderType: "24H" }),
        expect.objectContaining({ delay: expect.any(Number) }),
      );
      expect(reminderQueueAdd).toHaveBeenCalledWith(
        "session-reminder",
        expect.objectContaining({ bookingId: booking.id, reminderType: "1H" }),
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });

    it("rejects a student trying to accept a REQUESTED booking (only the tutor can)", async () => {
      const { user, booking } = await createRequestedBooking(
        "e2e-bookings-student-accept-wrong-actor",
        "2026-08-25T09:00:00.000Z",
      );
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/accept`)
        .set(...auth)
        .expect(400);
    });

    it("tutor declines a REQUESTED booking with a reason", async () => {
      const { user, booking } = await createRequestedBooking(
        "e2e-bookings-student-decline",
        "2026-09-01T09:00:00.000Z",
      );
      await tutorAuth();

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/decline`)
        .set(...auth)
        .send({ reason: "Jadwal bentrok" })
        .expect(200);

      expect(res.body.status).toBe("DECLINED");
      expect(res.body.declineReason).toBe("Jadwal bentrok");

      const notification = await prisma.notification.findFirst({
        where: { userId: user.id, type: "BOOKING_DECLINED" },
      });
      expect(notification).not.toBeNull();
    });

    it("tutor counter-proposes an alternate time and the student can accept it", async () => {
      const { user, booking } = await createRequestedBooking(
        "e2e-bookings-student-counter-accept",
        "2026-09-08T09:00:00.000Z",
      );
      await tutorAuth();

      const counterRes = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/counter-propose`)
        .set(...auth)
        .send({ proposedDate: "2026-09-15", proposedTime: "17:00" })
        .expect(200);

      expect(counterRes.body.status).toBe("COUNTER_PROPOSED");
      // 17:00 WIB (UTC+7) = 10:00 UTC.
      expect(counterRes.body.proposedScheduledAt).toBe("2026-09-15T10:00:00.000Z");

      const studentNotification = await prisma.notification.findFirst({
        where: { userId: user.id, type: "BOOKING_COUNTER_PROPOSED" },
      });
      expect(studentNotification).not.toBeNull();

      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      const acceptRes = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/accept`)
        .set(...auth)
        .expect(200);

      expect(acceptRes.body.status).toBe("ACCEPTED");
      expect(acceptRes.body.scheduledAt).toBe("2026-09-15T10:00:00.000Z");
    });

    it("tutor counter-proposes and the student declines, ending the booking", async () => {
      const { user, booking } = await createRequestedBooking(
        "e2e-bookings-student-counter-decline",
        "2026-09-22T09:00:00.000Z",
      );
      await tutorAuth();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/counter-propose`)
        .set(...auth)
        .send({ proposedDate: "2026-09-29", proposedTime: "17:00" })
        .expect(200);

      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      const declineRes = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/decline`)
        .set(...auth)
        .expect(200);

      expect(declineRes.body.status).toBe("DECLINED");

      const tutorUser = await prisma.user.findUniqueOrThrow({
        where: { firebaseUid: "e2e-bookings-tutor-1" },
      });
      const notification = await prisma.notification.findFirst({
        where: { userId: tutorUser.id, type: "BOOKING_DECLINED" },
      });
      expect(notification).not.toBeNull();
    });

    it("rejects a STUDENT trying to counter-propose (TUTOR-only route)", async () => {
      const { user, booking } = await createRequestedBooking(
        "e2e-bookings-student-counter-forbidden",
        "2026-10-13T09:00:00.000Z",
      );
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/counter-propose`)
        .set(...auth)
        .send({ proposedDate: "2026-10-20", proposedTime: "17:00" })
        .expect(403);
    });

    it("rejects accepting an already-declined booking", async () => {
      const { booking } = await createRequestedBooking(
        "e2e-bookings-student-invalid-transition",
        "2026-10-27T09:00:00.000Z",
      );
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "DECLINED" } });
      await tutorAuth();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/accept`)
        .set(...auth)
        .expect(400);
    });

    it("GET /bookings/:id/history returns the audit trail in chronological order", async () => {
      const { booking } = await createRequestedBooking(
        "e2e-bookings-student-history",
        "2026-11-03T09:00:00.000Z",
      );
      await tutorAuth();
      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/accept`)
        .set(...auth)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/bookings/${booking.id}/history`)
        .set(...auth)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].toStatus).toBe("ACCEPTED");
    });
  });

  describe("reschedule / cancel / no-show", () => {
    async function tutorAuth() {
      const tutorUser = await prisma.user.findUniqueOrThrow({
        where: { firebaseUid: "e2e-bookings-tutor-1" },
      });
      verifyIdToken.mockResolvedValue({ uid: tutorUser.firebaseUid });
      return tutorUser;
    }

    async function createAcceptedBooking(firebaseUid: string, scheduledAt: string) {
      const { user, profile } = await createStudent(firebaseUid);
      const booking = await prisma.booking.create({
        data: {
          studentId: profile.id,
          tutorId: tutorProfileId,
          subjectId,
          scheduledAt: new Date(scheduledAt),
          durationMinutes: 60,
          mode: "ONLINE",
          status: "ACCEPTED",
        },
      });
      return { user, booking };
    }

    it("tutor proposes a reschedule; student accepts, updating scheduledAt", async () => {
      const { user, booking } = await createAcceptedBooking(
        "e2e-bookings-student-reschedule-accept",
        "2027-01-05T09:00:00.000Z",
      );
      await tutorAuth();

      const proposeRes = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/reschedule`)
        .set(...auth)
        .send({ proposedDate: "2027-01-12", proposedTime: "17:00" })
        .expect(200);
      expect(proposeRes.body.status).toBe("RESCHEDULE_PROPOSED");
      expect(proposeRes.body.proposedScheduledAt).toBe("2027-01-12T10:00:00.000Z");

      const studentNotification = await prisma.notification.findFirst({
        where: { userId: user.id, type: "BOOKING_RESCHEDULE_PROPOSED" },
      });
      expect(studentNotification).not.toBeNull();

      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      const acceptRes = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/reschedule/accept`)
        .set(...auth)
        .expect(200);

      expect(acceptRes.body.status).toBe("ACCEPTED");
      expect(acceptRes.body.scheduledAt).toBe("2027-01-12T10:00:00.000Z");
    });

    it("tutor proposes a reschedule; student declines, keeping the original time", async () => {
      const { user, booking } = await createAcceptedBooking(
        "e2e-bookings-student-reschedule-decline",
        "2027-01-19T09:00:00.000Z",
      );
      await tutorAuth();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/reschedule`)
        .set(...auth)
        .send({ proposedDate: "2027-01-26", proposedTime: "17:00" })
        .expect(200);

      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      const declineRes = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/reschedule/decline`)
        .set(...auth)
        .expect(200);

      expect(declineRes.body.status).toBe("ACCEPTED");
      expect(declineRes.body.scheduledAt).toBe("2027-01-19T09:00:00.000Z");
      expect(declineRes.body.proposedScheduledAt).toBeNull();
    });

    it("rejects the proposer trying to respond to their own reschedule proposal", async () => {
      const { booking } = await createAcceptedBooking(
        "e2e-bookings-student-reschedule-self",
        "2027-02-02T09:00:00.000Z",
      );
      await tutorAuth();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/reschedule`)
        .set(...auth)
        .send({ proposedDate: "2027-02-09", proposedTime: "17:00" })
        .expect(200);

      // Still authenticated as the tutor (the proposer).
      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/reschedule/accept`)
        .set(...auth)
        .expect(400);
    });

    it("cancels an ACCEPTED booking outside the free window without flagging it late", async () => {
      const { booking } = await createAcceptedBooking(
        "e2e-bookings-student-cancel-free",
        "2027-02-16T09:00:00.000Z",
      );
      await tutorAuth();

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/cancel`)
        .set(...auth)
        .send({ reasonCode: "SCHEDULE_CONFLICT", details: "Ada urusan mendadak" })
        .expect(200);

      expect(res.body.status).toBe("CANCELLED");
      expect(res.body.isLateCancellation).toBe(false);
      expect(res.body.cancellationReasonCode).toBe("SCHEDULE_CONFLICT");
      expect(res.body.cancellationReason).toBe("Ada urusan mendadak");
    });

    it("flags a late cancellation when the session is inside the free-cancellation window", async () => {
      const { booking } = await createAcceptedBooking(
        "e2e-bookings-student-cancel-late",
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      );
      await tutorAuth();

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/cancel`)
        .set(...auth)
        .send({ reasonCode: "ILLNESS" })
        .expect(200);

      expect(res.body.isLateCancellation).toBe(true);
    });

    it("cancelling a REQUESTED booking is never flagged as late, regardless of timing", async () => {
      const { user, profile } = await createStudent("e2e-bookings-student-cancel-requested");
      const booking = await prisma.booking.create({
        data: {
          studentId: profile.id,
          tutorId: tutorProfileId,
          subjectId,
          scheduledAt: new Date(Date.now() + 30 * 60 * 1000),
          durationMinutes: 60,
          mode: "ONLINE",
          status: "REQUESTED",
        },
      });
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/cancel`)
        .set(...auth)
        .send({ reasonCode: "NO_LONGER_NEEDED" })
        .expect(200);

      expect(res.body.status).toBe("CANCELLED");
      expect(res.body.isLateCancellation).toBe(false);
    });

    it("rejects cancelling with an invalid reasonCode", async () => {
      const { booking } = await createAcceptedBooking(
        "e2e-bookings-student-cancel-invalid-reason",
        "2027-03-02T09:00:00.000Z",
      );
      await tutorAuth();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/cancel`)
        .set(...auth)
        .send({ reasonCode: "NOT_A_REAL_CODE" })
        .expect(400);
    });

    it("reports a no-show on a past ACCEPTED booking and notifies the other participant", async () => {
      const { user, booking } = await createAcceptedBooking(
        "e2e-bookings-student-no-show",
        new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      );
      await tutorAuth();

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/no-show`)
        .set(...auth)
        .expect(200);

      expect(res.body.noShowReported).toBe(true);

      const notification = await prisma.notification.findFirst({
        where: { userId: user.id, type: "BOOKING_NO_SHOW_REPORTED" },
      });
      expect(notification).not.toBeNull();
    });

    it("rejects reporting a no-show before the session time has passed", async () => {
      const { booking } = await createAcceptedBooking(
        "e2e-bookings-student-no-show-future",
        "2027-03-09T09:00:00.000Z",
      );
      await tutorAuth();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/no-show`)
        .set(...auth)
        .expect(400);
    });
  });

  describe("meeting link / address (Task 4.3)", () => {
    async function tutorAuth() {
      const tutorUser = await prisma.user.findUniqueOrThrow({
        where: { firebaseUid: "e2e-bookings-tutor-1" },
      });
      verifyIdToken.mockResolvedValue({ uid: tutorUser.firebaseUid });
      return tutorUser;
    }

    async function createAcceptedBooking(firebaseUid: string, mode: "ONLINE" | "OFFLINE") {
      const student = await prisma.user.create({
        data: { firebaseUid, role: "STUDENT", phone: `+62812345${Math.floor(Math.random() * 100000)}` },
      });
      const profile = await prisma.studentProfile.create({ data: { userId: student.id } });
      const booking = await prisma.booking.create({
        data: {
          studentId: profile.id,
          tutorId: tutorProfileId,
          subjectId,
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          durationMinutes: 60,
          mode,
          status: "ACCEPTED",
        },
      });
      return { student, booking };
    }

    it("sets a Zoom link for an ONLINE booking, visible on the booking detail response", async () => {
      const { booking } = await createAcceptedBooking("e2e-bookings-student-meeting-online", "ONLINE");
      await tutorAuth();

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/meeting`)
        .set(...auth)
        .send({ meetingLink: "https://zoom.us/j/123456789" })
        .expect(200);

      expect(res.body.meetingLink).toBe("https://zoom.us/j/123456789");

      const detail = await request(app.getHttpServer())
        .get(`/api/bookings/${booking.id}`)
        .set(...auth)
        .expect(200);
      expect(detail.body.meetingLink).toBe("https://zoom.us/j/123456789");
    });

    it("rejects an invalid meeting URL for an ONLINE booking", async () => {
      const { booking } = await createAcceptedBooking("e2e-bookings-student-meeting-invalid", "ONLINE");
      await tutorAuth();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/meeting`)
        .set(...auth)
        .send({ meetingLink: "https://evil.example.com/join" })
        .expect(400);
    });

    it("sets a meeting address for an OFFLINE booking", async () => {
      const { booking, student } = await createAcceptedBooking(
        "e2e-bookings-student-meeting-offline",
        "OFFLINE",
      );
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });

      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/meeting`)
        .set(...auth)
        .send({ meetingAddress: "Jl. Sudirman No. 1, Jakarta Selatan" })
        .expect(200);

      expect(res.body.meetingAddress).toBe("Jl. Sudirman No. 1, Jakarta Selatan");
      expect(res.body.meetingLink).toBeNull();
    });

    it("rejects a missing meetingAddress for an OFFLINE booking", async () => {
      const { booking } = await createAcceptedBooking("e2e-bookings-student-meeting-offline-2", "OFFLINE");
      await tutorAuth();

      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/meeting`)
        .set(...auth)
        .send({})
        .expect(400);
    });
  });
});
