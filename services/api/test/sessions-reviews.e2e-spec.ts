import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import request from "supertest";
import { BookingStatus } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { FirebaseAdminService } from "../src/auth/firebase-admin.service";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  BOOKING_EXPIRY_QUEUE,
  PAYMENT_EXPIRY_QUEUE,
  SESSION_AUTO_COMPLETE_QUEUE,
  SESSION_REMINDER_QUEUE,
} from "../src/jobs/jobs.module";
import { BookingExpiryProcessor } from "../src/bookings/processors/booking-expiry.processor";
import { SessionReminderProcessor } from "../src/bookings/processors/session-reminder.processor";
import { SessionAutoCompleteProcessor } from "../src/bookings/processors/session-auto-complete.processor";
import { PaymentExpiryProcessor } from "../src/payments/processors/payment-expiry.processor";

// Session completion (Task 6.1), post-session notes (Task 6.3), reviews
// (Task 6.4), and rating aggregation (Task 6.5) - all fully live against
// real Postgres, no external gateway involved. Bookings are seeded
// directly at whatever status/scheduledAt each test needs (real
// POST /bookings + accept + pay + webhook is already covered end to end
// in payments-webhook.e2e-spec.ts) since what's under test here is the
// lifecycle/review logic downstream of CONFIRMED, not how a booking gets
// there.
describe("Sessions & Reviews (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const verifyIdToken = jest.fn();
  const auth = ["Authorization", "Bearer good-token"] as const;

  let subjectId: string;
  let tutorProfileId: string;
  let tutorUserId: string;
  const createdTutorProfileIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseAdminService)
      .useValue({ verifyIdToken })
      .overrideProvider(getQueueToken(BOOKING_EXPIRY_QUEUE))
      .useValue({ add: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(getQueueToken(SESSION_REMINDER_QUEUE))
      .useValue({ add: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(getQueueToken(PAYMENT_EXPIRY_QUEUE))
      .useValue({ add: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(getQueueToken(SESSION_AUTO_COMPLETE_QUEUE))
      .useValue({ add: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(BookingExpiryProcessor)
      .useValue({})
      .overrideProvider(SessionReminderProcessor)
      .useValue({})
      .overrideProvider(SessionAutoCompleteProcessor)
      .useValue({})
      .overrideProvider(PaymentExpiryProcessor)
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

    const { tutorProfileId: id, tutorUserId: userId } = await createTutor("e2e-sessions-tutor-1");
    tutorProfileId = id;
    tutorUserId = userId;
  });

  afterAll(async () => {
    for (const id of createdTutorProfileIds) {
      await prisma.review.deleteMany({ where: { booking: { tutorId: id } } });
      await prisma.bookingStatusHistory.deleteMany({ where: { booking: { tutorId: id } } });
      await prisma.booking.deleteMany({ where: { tutorId: id } });
      await prisma.tutorProfile.deleteMany({ where: { id } });
    }
    await prisma.notification.deleteMany({
      where: { user: { firebaseUid: { startsWith: "e2e-sessions-" } } },
    });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: "e2e-sessions-tutor" } } });
    await prisma.studentProfile.deleteMany({
      where: { user: { firebaseUid: { startsWith: "e2e-sessions-student" } } },
    });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: "e2e-sessions-student" } } });
    await app.close();
  });

  async function createTutor(firebaseUid: string) {
    const tutorUser = await prisma.user.create({
      data: {
        firebaseUid,
        role: "TUTOR",
        phone: `+62812345${Math.floor(Math.random() * 100000)}`,
      },
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
    createdTutorProfileIds.push(tutorProfile.id);
    return { tutorProfileId: tutorProfile.id, tutorUserId: tutorUser.id };
  }

  async function tutorAuth(firebaseUid = "e2e-sessions-tutor-1") {
    verifyIdToken.mockResolvedValue({ uid: firebaseUid });
  }

  async function createStudent(firebaseUid: string) {
    const user = await prisma.user.create({
      data: { firebaseUid, role: "STUDENT", phone: `+62812345${Math.floor(Math.random() * 100000)}` },
    });
    const profile = await prisma.studentProfile.create({ data: { userId: user.id } });
    return { user, profile };
  }

  async function createBooking(
    firebaseUid: string,
    status: BookingStatus,
    scheduledAt: Date,
    forTutorProfileId = tutorProfileId,
  ) {
    const { user, profile } = await createStudent(firebaseUid);
    const booking = await prisma.booking.create({
      data: {
        studentId: profile.id,
        tutorId: forTutorProfileId,
        subjectId,
        scheduledAt,
        durationMinutes: 60,
        priceAmount: 100000,
        mode: "ONLINE",
        status,
      },
    });
    return { user, booking };
  }

  describe("PATCH /bookings/:id/complete", () => {
    it("returns 400 before the session's scheduled end time has passed", async () => {
      const { booking } = await createBooking(
        "e2e-sessions-student-early",
        "CONFIRMED",
        new Date(Date.now() + 60 * 60 * 1000),
      );
      await tutorAuth();
      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/complete`)
        .set(...auth)
        .expect(400);
    });

    it("returns 403 for the student trying to mark it complete", async () => {
      const { user, booking } = await createBooking(
        "e2e-sessions-student-wrong-actor",
        "CONFIRMED",
        new Date(Date.now() - 2 * 60 * 60 * 1000),
      );
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/complete`)
        .set(...auth)
        .expect(403);
    });

    it("returns 400 for a booking that isn't CONFIRMED", async () => {
      const { booking } = await createBooking(
        "e2e-sessions-student-badstate",
        "ACCEPTED",
        new Date(Date.now() - 2 * 60 * 60 * 1000),
      );
      await tutorAuth();
      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/complete`)
        .set(...auth)
        .expect(400);
    });

    it("moves a past-due CONFIRMED booking to COMPLETED and notifies the student to review", async () => {
      const { user, booking } = await createBooking(
        "e2e-sessions-student-complete",
        "CONFIRMED",
        new Date(Date.now() - 2 * 60 * 60 * 1000),
      );
      await tutorAuth();
      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/complete`)
        .set(...auth)
        .expect(200);

      expect(res.body.status).toBe("COMPLETED");
      expect(res.body.completedByUserId).toBe(tutorUserId);

      const notification = await prisma.notification.findFirst({
        where: { userId: user.id, type: "REVIEW_PROMPT" },
      });
      expect(notification).not.toBeNull();
    });
  });

  describe("PATCH /bookings/:id/notes", () => {
    it("rejects adding notes before the booking is COMPLETED", async () => {
      const { booking } = await createBooking(
        "e2e-sessions-student-notes-early",
        "CONFIRMED",
        new Date(Date.now() - 60 * 60 * 1000),
      );
      await tutorAuth();
      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/notes`)
        .set(...auth)
        .send({ notes: "too soon" })
        .expect(400);
    });

    it("lets the tutor add notes to a COMPLETED booking, visible to the student read-only", async () => {
      const { user, booking } = await createBooking(
        "e2e-sessions-student-notes",
        "COMPLETED",
        new Date(Date.now() - 60 * 60 * 1000),
      );
      await tutorAuth();
      const res = await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/notes`)
        .set(...auth)
        .send({ notes: "Membahas aljabar linear, PR bab 3" })
        .expect(200);
      expect(res.body.sessionNotes).toBe("Membahas aljabar linear, PR bab 3");

      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      const asStudent = await request(app.getHttpServer())
        .get(`/api/bookings/${booking.id}`)
        .set(...auth)
        .expect(200);
      expect(asStudent.body.sessionNotes).toBe("Membahas aljabar linear, PR bab 3");
    });

    it("rejects a student trying to add notes", async () => {
      const { user, booking } = await createBooking(
        "e2e-sessions-student-notes-403",
        "COMPLETED",
        new Date(Date.now() - 60 * 60 * 1000),
      );
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      await request(app.getHttpServer())
        .patch(`/api/bookings/${booking.id}/notes`)
        .set(...auth)
        .send({ notes: "sneaky" })
        .expect(403);
    });
  });

  describe("reviews", () => {
    it("rejects a review before the booking is COMPLETED", async () => {
      const { user, booking } = await createBooking(
        "e2e-sessions-student-review-early",
        "CONFIRMED",
        new Date(Date.now() - 60 * 60 * 1000),
      );
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/review`)
        .set(...auth)
        .send({ rating: 5 })
        .expect(400);
    });

    it("lets the student submit a review once COMPLETED, and blocks the tutor from reviewing", async () => {
      const { user, booking } = await createBooking(
        "e2e-sessions-student-review",
        "COMPLETED",
        new Date(Date.now() - 60 * 60 * 1000),
      );
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/review`)
        .set(...auth)
        .send({ rating: 5, text: "Tutor sangat membantu" })
        .expect(201);
      expect(res.body.rating).toBe(5);

      await tutorAuth();
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/review`)
        .set(...auth)
        .send({ rating: 1 })
        .expect(403);
    });

    it("edits an existing review within the window instead of creating a duplicate", async () => {
      const { user, booking } = await createBooking(
        "e2e-sessions-student-review-edit",
        "COMPLETED",
        new Date(Date.now() - 60 * 60 * 1000),
      );
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/review`)
        .set(...auth)
        .send({ rating: 3, text: "Lumayan" })
        .expect(201);

      const edited = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/review`)
        .set(...auth)
        .send({ rating: 5, text: "Setelah dipikir lagi, sangat bagus" })
        .expect(201);
      expect(edited.body.rating).toBe(5);

      const count = await prisma.review.count({ where: { bookingId: booking.id } });
      expect(count).toBe(1);
    });

    it("flags a review containing a filtered keyword, still saves it, and excludes it from the tutor's public average", async () => {
      const { tutorProfileId: flaggedTutorId } = await createTutor("e2e-sessions-tutor-flagged");
      const { user, booking } = await createBooking(
        "e2e-sessions-student-review-flagged",
        "COMPLETED",
        new Date(Date.now() - 60 * 60 * 1000),
        flaggedTutorId,
      );
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/review`)
        .set(...auth)
        .send({ rating: 1, text: "Tutor ini tolol sekali" })
        .expect(201);

      const review = await prisma.review.findUnique({ where: { bookingId: booking.id } });
      expect(review!.flagged).toBe(true);

      const detail = await request(app.getHttpServer())
        .get(`/api/tutors/${flaggedTutorId}`)
        .expect(200);
      expect(detail.body.rating).toBeNull();
      expect(detail.body.reviewCount).toBe(0);

      const listed = await request(app.getHttpServer())
        .get(`/api/tutors/${flaggedTutorId}/reviews`)
        .expect(200);
      expect(listed.body.data).toHaveLength(0);
    });
  });

  describe("rating aggregation (Task 6.5)", () => {
    it("updates the tutor's average rating/review count immediately, visible on the public detail and reviews endpoints", async () => {
      const { tutorProfileId: ratingTutorId } = await createTutor("e2e-sessions-tutor-rating");
      const { user: user1, booking: booking1 } = await createBooking(
        "e2e-sessions-student-agg-1",
        "COMPLETED",
        new Date(Date.now() - 60 * 60 * 1000),
        ratingTutorId,
      );
      const { user: user2, booking: booking2 } = await createBooking(
        "e2e-sessions-student-agg-2",
        "COMPLETED",
        new Date(Date.now() - 60 * 60 * 1000),
        ratingTutorId,
      );

      verifyIdToken.mockResolvedValue({ uid: user1.firebaseUid });
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking1.id}/review`)
        .set(...auth)
        .send({ rating: 4 })
        .expect(201);

      verifyIdToken.mockResolvedValue({ uid: user2.firebaseUid });
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking2.id}/review`)
        .set(...auth)
        .send({ rating: 2 })
        .expect(201);

      const detail = await request(app.getHttpServer())
        .get(`/api/tutors/${ratingTutorId}`)
        .expect(200);
      expect(detail.body.rating).toBe(3);
      expect(detail.body.reviewCount).toBe(2);

      const list = await request(app.getHttpServer())
        .get(`/api/tutors/${ratingTutorId}/reviews`)
        .expect(200);
      expect(list.body.total).toBe(2);
      expect(list.body.data.map((r: { rating: number }) => r.rating).sort()).toEqual([2, 4]);
    });

    it("reflects real ratings in the tutor search listing sorted by rating", async () => {
      const { tutorProfileId: highTutorId } = await createTutor("e2e-sessions-tutor-high");
      const { user, booking } = await createBooking(
        "e2e-sessions-student-sort",
        "COMPLETED",
        new Date(Date.now() - 60 * 60 * 1000),
        highTutorId,
      );

      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/review`)
        .set(...auth)
        .send({ rating: 5 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/tutors?sort=rating&limit=50`)
        .expect(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(highTutorId);
      // Highest-rated tutor sorts before an unrated one (nulls last).
      const highIndex = ids.indexOf(highTutorId);
      const unratedIndex = ids.indexOf(tutorProfileId);
      if (unratedIndex !== -1) {
        expect(highIndex).toBeLessThan(unratedIndex);
      }
    });
  });
});
