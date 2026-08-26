import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import request from "supertest";
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

// Task 7.1 (RBAC + audit log), 7.3 (user/booking management), 7.4
// (transaction reconciliation), 7.5 (reported chat content), 7.6
// (analytics) - all fully live against real Postgres, no external gateway
// involved.
describe("Admin Panel (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const verifyIdToken = jest.fn();
  const auth = ["Authorization", "Bearer good-token"] as const;

  let subjectId: string;
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

    await prisma.user.create({
      data: {
        firebaseUid: "e2e-adminpanel-super",
        role: "ADMIN",
        adminRole: "SUPER_ADMIN",
        phone: "+6281234583001",
      },
    });
    await prisma.user.create({
      data: {
        firebaseUid: "e2e-adminpanel-support",
        role: "ADMIN",
        adminRole: "SUPPORT",
        phone: "+6281234583002",
      },
    });
  });

  afterAll(async () => {
    for (const id of createdTutorProfileIds) {
      await prisma.messageReport.deleteMany({ where: { conversation: { booking: { tutorId: id } } } });
      await prisma.conversation.deleteMany({ where: { booking: { tutorId: id } } });
      await prisma.review.deleteMany({ where: { booking: { tutorId: id } } });
      await prisma.transaction.deleteMany({ where: { booking: { tutorId: id } } });
      await prisma.bookingStatusHistory.deleteMany({ where: { booking: { tutorId: id } } });
      await prisma.booking.deleteMany({ where: { tutorId: id } });
      await prisma.tutorProfile.deleteMany({ where: { id } });
    }
    await prisma.auditLog.deleteMany({
      where: { adminUser: { firebaseUid: { startsWith: "e2e-adminpanel-" } } },
    });
    await prisma.notification.deleteMany({
      where: { user: { firebaseUid: { startsWith: "e2e-adminpanel-" } } },
    });
    await prisma.studentProfile.deleteMany({
      where: { user: { firebaseUid: { startsWith: "e2e-adminpanel-student" } } },
    });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: "e2e-adminpanel-" } } });
    await app.close();
  });

  async function superAdminAuth() {
    verifyIdToken.mockResolvedValue({ uid: "e2e-adminpanel-super" });
  }

  async function supportAdminAuth() {
    verifyIdToken.mockResolvedValue({ uid: "e2e-adminpanel-support" });
  }

  async function createStudent(firebaseUid: string) {
    const user = await prisma.user.create({
      data: { firebaseUid, role: "STUDENT", phone: `+62812345${Math.floor(Math.random() * 100000)}` },
    });
    const profile = await prisma.studentProfile.create({ data: { userId: user.id } });
    return { user, profile };
  }

  async function createTutor(firebaseUid: string, city = "Jakarta Selatan") {
    const tutorUser = await prisma.user.create({
      data: { firebaseUid, role: "TUTOR", phone: `+62812345${Math.floor(Math.random() * 100000)}` },
    });
    const tutorProfile = await prisma.tutorProfile.create({
      data: {
        userId: tutorUser.id,
        city,
        verificationStatus: "VERIFIED",
        teachingModes: ["ONLINE"],
        hourlyRate: 100000,
      },
    });
    createdTutorProfileIds.push(tutorProfile.id);
    return { tutorProfile, tutorUser };
  }

  async function createBooking(
    tutorProfileId: string,
    studentFirebaseUid: string,
    status: "REQUESTED" | "ACCEPTED" | "CONFIRMED" | "COMPLETED",
    overrides: Record<string, unknown> = {},
  ) {
    const { user, profile } = await createStudent(studentFirebaseUid);
    const booking = await prisma.booking.create({
      data: {
        studentId: profile.id,
        tutorId: tutorProfileId,
        subjectId,
        scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
        durationMinutes: 60,
        priceAmount: 100000,
        mode: "ONLINE",
        status,
        ...overrides,
      },
    });
    return { user, booking };
  }

  describe("RBAC (Task 7.1)", () => {
    it("returns 403 for a non-admin hitting any internal admin route", async () => {
      const { user } = await createStudent("e2e-adminpanel-student-rbac");
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      await request(app.getHttpServer()).get("/api/internal/users").set(...auth).expect(403);
      await request(app.getHttpServer()).get("/api/internal/bookings").set(...auth).expect(403);
      await request(app.getHttpServer())
        .get("/api/internal/analytics/summary")
        .set(...auth)
        .expect(403);
    });

    it("lets a SUPPORT admin view users/bookings/transactions/audit-log", async () => {
      await supportAdminAuth();
      await request(app.getHttpServer()).get("/api/internal/users").set(...auth).expect(200);
      await request(app.getHttpServer()).get("/api/internal/bookings").set(...auth).expect(200);
      await request(app.getHttpServer()).get("/api/internal/transactions").set(...auth).expect(200);
      await request(app.getHttpServer()).get("/api/internal/audit-log").set(...auth).expect(200);
    });

    it("rejects a SUPPORT admin performing Super-Admin-only actions", async () => {
      await supportAdminAuth();
      await request(app.getHttpServer())
        .patch("/api/internal/payouts/fake-id/status")
        .set(...auth)
        .send({ status: "PROCESSING" })
        .expect(403);
      await request(app.getHttpServer())
        .patch("/api/internal/bookings/fake-id/override-cancel")
        .set(...auth)
        .send({ reason: "test" })
        .expect(403);
      await request(app.getHttpServer())
        .patch("/api/internal/users/fake-id/admin-role")
        .set(...auth)
        .send({ adminRole: "SUPPORT" })
        .expect(403);
    });
  });

  describe("audit log (Task 7.1)", () => {
    it("records who suspended a user, when, and why", async () => {
      const { user } = await createStudent("e2e-adminpanel-student-audit");
      await superAdminAuth();

      await request(app.getHttpServer())
        .patch(`/api/internal/users/${user.id}/suspend`)
        .set(...auth)
        .send({ reason: "Aktivitas mencurigakan" })
        .expect(200);

      const log = await request(app.getHttpServer())
        .get("/api/internal/audit-log?targetType=User")
        .set(...auth)
        .expect(200);
      const entry = log.body.data.find(
        (l: { targetId: string; action: string }) => l.targetId === user.id && l.action === "user.suspend",
      );
      expect(entry).toBeDefined();
      expect(entry.metadata.reason).toBe("Aktivitas mencurigakan");
    });
  });

  describe("suspend / reinstate (Task 7.3)", () => {
    it("actually blocks a suspended user's API access, then unblocks on reinstate", async () => {
      const { user } = await createStudent("e2e-adminpanel-student-suspend");
      await superAdminAuth();

      await request(app.getHttpServer())
        .patch(`/api/internal/users/${user.id}/suspend`)
        .set(...auth)
        .send({ reason: "test" })
        .expect(200);

      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      await request(app.getHttpServer()).get("/api/users/me").set(...auth).expect(401);

      await superAdminAuth();
      await request(app.getHttpServer())
        .patch(`/api/internal/users/${user.id}/reinstate`)
        .set(...auth)
        .expect(200);

      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      await request(app.getHttpServer()).get("/api/users/me").set(...auth).expect(200);
    });
  });

  describe("admin role management (Task 7.1)", () => {
    it("lets Super Admin set a sub-role on an existing ADMIN account", async () => {
      const newAdmin = await prisma.user.create({
        data: { firebaseUid: "e2e-adminpanel-newadmin", role: "ADMIN", phone: "+6281234583099" },
      });
      await superAdminAuth();

      const res = await request(app.getHttpServer())
        .patch(`/api/internal/users/${newAdmin.id}/admin-role`)
        .set(...auth)
        .send({ adminRole: "SUPPORT" })
        .expect(200);
      expect(res.body.adminRole).toBe("SUPPORT");
    });

    it("rejects setting an admin sub-role on a non-ADMIN account", async () => {
      const { user } = await createStudent("e2e-adminpanel-student-rolefail");
      await superAdminAuth();

      await request(app.getHttpServer())
        .patch(`/api/internal/users/${user.id}/admin-role`)
        .set(...auth)
        .send({ adminRole: "SUPPORT" })
        .expect(400);
    });
  });

  describe("booking override (Task 7.3)", () => {
    it("force-cancels a non-terminal booking, restricted to Super Admin and audit-logged", async () => {
      const { tutorProfile } = await createTutor("e2e-adminpanel-tutor-override");
      const { user, booking } = await createBooking(
        tutorProfile.id,
        "e2e-adminpanel-student-override",
        "CONFIRMED",
      );

      await superAdminAuth();
      const res = await request(app.getHttpServer())
        .patch(`/api/internal/bookings/${booking.id}/override-cancel`)
        .set(...auth)
        .send({ reason: "Force majeure edge case" })
        .expect(200);
      expect(res.body.status).toBe("CANCELLED");

      const notification = await prisma.notification.findFirst({
        where: { userId: user.id, type: "BOOKING_CANCELLED" },
      });
      expect(notification).not.toBeNull();

      const log = await request(app.getHttpServer())
        .get("/api/internal/audit-log?targetType=Booking")
        .set(...auth)
        .expect(200);
      expect(
        log.body.data.some(
          (l: { targetId: string; action: string }) =>
            l.targetId === booking.id && l.action === "booking.override_cancel",
        ),
      ).toBe(true);
    });

    it("rejects overriding an already-terminal booking", async () => {
      const { tutorProfile } = await createTutor("e2e-adminpanel-tutor-override2");
      const { booking } = await createBooking(
        tutorProfile.id,
        "e2e-adminpanel-student-override2",
        "COMPLETED",
      );

      await superAdminAuth();
      await request(app.getHttpServer())
        .patch(`/api/internal/bookings/${booking.id}/override-cancel`)
        .set(...auth)
        .send({ reason: "test" })
        .expect(400);
    });
  });

  describe("hard delete user (Task 7.3)", () => {
    it("deletes a tutor who has bookings, transactions, history, and a dispute", async () => {
      const { tutorProfile, tutorUser } = await createTutor("e2e-adminpanel-tutor-harddelete");
      const { booking } = await createBooking(
        tutorProfile.id,
        "e2e-adminpanel-student-harddelete",
        "COMPLETED",
        {
          requestedByUserId: tutorUser.id,
          completedByUserId: tutorUser.id,
          meetingSetByUserId: tutorUser.id,
        },
      );
      await prisma.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          toStatus: "COMPLETED",
          changedByUserId: tutorUser.id,
        },
      });
      await prisma.transaction.create({
        data: { bookingId: booking.id, amount: 100000, commission: 15000, status: "PAID" },
      });
      await prisma.dispute.create({
        data: {
          bookingId: booking.id,
          raisedByUserId: tutorUser.id,
          reason: "e2e hard-delete fixture",
        },
      });

      await superAdminAuth();
      await request(app.getHttpServer())
        .delete(`/api/internal/users/${tutorUser.id}`)
        .set(...auth)
        .expect(204);

      expect(await prisma.user.findUnique({ where: { id: tutorUser.id } })).toBeNull();
    });
  });

  describe("user & booking search (Task 7.3)", () => {
    it("finds a user by search query", async () => {
      const { user } = await createStudent("e2e-adminpanel-student-search");
      await prisma.user.update({ where: { id: user.id }, data: { name: "Zzyzx Findme" } });
      await supportAdminAuth();

      const res = await request(app.getHttpServer())
        .get("/api/internal/users?q=Zzyzx")
        .set(...auth)
        .expect(200);
      expect(res.body.data.some((u: { id: string }) => u.id === user.id)).toBe(true);
    });

    it("finds a booking by status filter and returns full detail without participant restriction", async () => {
      const { tutorProfile } = await createTutor("e2e-adminpanel-tutor-search");
      const { booking } = await createBooking(
        tutorProfile.id,
        "e2e-adminpanel-student-booking-search",
        "CONFIRMED",
      );
      await supportAdminAuth();

      const list = await request(app.getHttpServer())
        .get("/api/internal/bookings?status=CONFIRMED")
        .set(...auth)
        .expect(200);
      expect(list.body.data.some((b: { id: string }) => b.id === booking.id)).toBe(true);

      const detail = await request(app.getHttpServer())
        .get(`/api/internal/bookings/${booking.id}`)
        .set(...auth)
        .expect(200);
      expect(detail.body.id).toBe(booking.id);
    });
  });

  describe("transaction reconciliation (Task 7.4)", () => {
    it("surfaces a seeded stale PENDING transaction", async () => {
      const { tutorProfile } = await createTutor("e2e-adminpanel-tutor-recon");
      const { booking } = await createBooking(
        tutorProfile.id,
        "e2e-adminpanel-student-recon",
        "ACCEPTED",
      );
      const staleTransaction = await prisma.transaction.create({
        data: {
          bookingId: booking.id,
          amount: 100000,
          commission: 15000,
          status: "PENDING",
          createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30h ago, past the 24h payment window
        },
      });

      await supportAdminAuth();
      const res = await request(app.getHttpServer())
        .get("/api/internal/transactions/reconciliation")
        .set(...auth)
        .expect(200);

      expect(res.body.data.some((t: { id: string }) => t.id === staleTransaction.id)).toBe(true);
    });

    it("does not flag a recent PENDING transaction", async () => {
      const { tutorProfile } = await createTutor("e2e-adminpanel-tutor-recon2");
      const { booking } = await createBooking(
        tutorProfile.id,
        "e2e-adminpanel-student-recon2",
        "ACCEPTED",
      );
      const freshTransaction = await prisma.transaction.create({
        data: { bookingId: booking.id, amount: 100000, commission: 15000, status: "PENDING" },
      });

      await supportAdminAuth();
      const res = await request(app.getHttpServer())
        .get("/api/internal/transactions/reconciliation")
        .set(...auth)
        .expect(200);

      expect(res.body.data.some((t: { id: string }) => t.id === freshTransaction.id)).toBe(false);
    });
  });

  describe("reported chat content (Task 7.5)", () => {
    it("surfaces a reported message/user in the admin reports list", async () => {
      const { tutorProfile, tutorUser } = await createTutor("e2e-adminpanel-tutor-report");
      const { user: studentUser } = await createStudent("e2e-adminpanel-student-report");
      const booking = await prisma.booking.create({
        data: {
          studentId: (await prisma.studentProfile.findUniqueOrThrow({ where: { userId: studentUser.id } })).id,
          tutorId: tutorProfile.id,
          subjectId,
          scheduledAt: new Date(),
          durationMinutes: 60,
          mode: "ONLINE",
          status: "ACCEPTED",
        },
      });
      const conversation = await prisma.conversation.create({ data: { bookingId: booking.id } });
      const report = await prisma.messageReport.create({
        data: {
          conversationId: conversation.id,
          reporterId: studentUser.id,
          reportedUserId: tutorUser.id,
          reason: "Meminta pembayaran di luar platform",
        },
      });

      await supportAdminAuth();
      const res = await request(app.getHttpServer()).get("/api/internal/reports").set(...auth).expect(200);
      expect(res.body.some((r: { id: string }) => r.id === report.id)).toBe(true);
    });
  });

  describe("analytics (Task 7.6)", () => {
    it("reflects real seeded registrations/completions/GMV via before/after delta", async () => {
      await superAdminAuth();
      const before = await request(app.getHttpServer())
        .get("/api/internal/analytics/summary")
        .set(...auth)
        .expect(200);

      const { tutorProfile } = await createTutor("e2e-adminpanel-tutor-analytics");
      const { booking } = await createBooking(
        tutorProfile.id,
        "e2e-adminpanel-student-analytics",
        "COMPLETED",
        { completedAt: new Date() },
      );
      await prisma.transaction.create({
        data: {
          bookingId: booking.id,
          amount: 200000,
          commission: 30000,
          status: "PAID",
          paidAt: new Date(),
        },
      });
      await prisma.review.create({ data: { bookingId: booking.id, rating: 5, flagged: false } });

      const after = await request(app.getHttpServer())
        .get("/api/internal/analytics/summary")
        .set(...auth)
        .expect(200);

      expect(after.body.registeredTutors - before.body.registeredTutors).toBe(1);
      expect(after.body.registeredStudents - before.body.registeredStudents).toBe(1);
      expect(after.body.completedBookings - before.body.completedBookings).toBe(1);
      expect(after.body.gmv - before.body.gmv).toBe(200000);
      expect(after.body.platformTake - before.body.platformTake).toBe(30000);
      expect(after.body.ratingCount - before.body.ratingCount).toBe(1);
    });

    it("correctly recomputes widgets when a date range excludes older data", async () => {
      const { tutorProfile } = await createTutor("e2e-adminpanel-tutor-daterange");
      const { booking } = await createBooking(
        tutorProfile.id,
        "e2e-adminpanel-student-daterange",
        "COMPLETED",
        { completedAt: new Date("2020-01-01T00:00:00.000Z") },
      );
      void booking;

      await superAdminAuth();
      const recentOnly = await request(app.getHttpServer())
        .get("/api/internal/analytics/summary?from=2025-01-01")
        .set(...auth)
        .expect(200);
      const allTime = await request(app.getHttpServer())
        .get("/api/internal/analytics/summary?from=2019-01-01")
        .set(...auth)
        .expect(200);

      // The 2020 completion is excluded from the recent-only range but
      // included once the range widens to cover it.
      expect(allTime.body.completedBookings).toBeGreaterThan(recentOnly.body.completedBookings);
    });

    it("attributes bookings/GMV to the tutor's registered city", async () => {
      const uniqueCity = "KotaUjiE2EAdminPanel";
      const { tutorProfile } = await createTutor("e2e-adminpanel-tutor-city", uniqueCity);
      const { booking } = await createBooking(
        tutorProfile.id,
        "e2e-adminpanel-student-city",
        "COMPLETED",
        { completedAt: new Date() },
      );
      await prisma.transaction.create({
        data: {
          bookingId: booking.id,
          amount: 50000,
          commission: 7500,
          status: "PAID",
          paidAt: new Date(),
        },
      });

      await supportAdminAuth();
      const res = await request(app.getHttpServer())
        .get("/api/internal/analytics/cities")
        .set(...auth)
        .expect(200);

      const cityEntry = res.body.find((c: { city: string }) => c.city === uniqueCity);
      expect(cityEntry).toEqual({ city: uniqueCity, bookingCount: 1, gmv: 50000, platformTake: 7500 });
    });
  });
});
