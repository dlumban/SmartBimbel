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

// Midtrans isn't provisioned in this environment (no MIDTRANS_SERVER_KEY/
// MIDTRANS_CLIENT_KEY) - see payments-webhook.e2e-spec.ts for the full
// pay -> webhook -> CONFIRMED flow tested against a deterministic fake
// MidtransService. This file covers everything that's genuinely live
// against real Postgres regardless of the gateway (locking priceAmount,
// role/state guards, the transaction ledger, payouts, disputes without a
// refund, earnings) plus the real 503 gate itself, which is worth
// verifying just like Task 4.x's Stream 503 tests.
describe("Payments / Payouts / Disputes (e2e, real unconfigured Midtrans)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const verifyIdToken = jest.fn();
  const auth = ["Authorization", "Bearer good-token"] as const;

  let tutorProfileId: string;
  let tutorUserId: string;
  let subjectId: string;

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

    const tutorUser = await prisma.user.create({
      data: { firebaseUid: "e2e-payments-tutor-1", role: "TUTOR", phone: "+6281234580001" },
    });
    tutorUserId = tutorUser.id;
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

    await prisma.user.create({
      data: {
        firebaseUid: "e2e-payments-admin-1",
        role: "ADMIN",
        adminRole: "SUPER_ADMIN",
        phone: "+6281234580099",
      },
    });
  });

  afterAll(async () => {
    await prisma.dispute.deleteMany({ where: { booking: { tutorId: tutorProfileId } } });
    await prisma.transaction.deleteMany({ where: { booking: { tutorId: tutorProfileId } } });
    await prisma.payout.deleteMany({ where: { tutorId: tutorProfileId } });
    await prisma.bookingStatusHistory.deleteMany({ where: { booking: { tutorId: tutorProfileId } } });
    await prisma.conversation.deleteMany({ where: { booking: { tutorId: tutorProfileId } } });
    await prisma.notification.deleteMany({
      where: {
        user: {
          OR: [
            { firebaseUid: "e2e-payments-tutor-1" },
            { firebaseUid: "e2e-payments-admin-1" },
            { firebaseUid: { startsWith: "e2e-payments-student" } },
          ],
        },
      },
    });
    await prisma.booking.deleteMany({ where: { tutorId: tutorProfileId } });
    await prisma.tutorProfile.deleteMany({ where: { id: tutorProfileId } });
    await prisma.user.deleteMany({ where: { firebaseUid: "e2e-payments-tutor-1" } });
    await prisma.auditLog.deleteMany({ where: { adminUser: { firebaseUid: "e2e-payments-admin-1" } } });
    await prisma.user.deleteMany({ where: { firebaseUid: "e2e-payments-admin-1" } });
    await prisma.studentProfile.deleteMany({
      where: { user: { firebaseUid: { startsWith: "e2e-payments-student" } } },
    });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: "e2e-payments-student" } } });
    await app.close();
  });

  async function tutorAuth() {
    verifyIdToken.mockResolvedValue({ uid: "e2e-payments-tutor-1" });
  }

  async function adminAuth() {
    verifyIdToken.mockResolvedValue({ uid: "e2e-payments-admin-1" });
  }

  async function createStudent(firebaseUid: string) {
    const user = await prisma.user.create({
      data: { firebaseUid, role: "STUDENT", phone: `+62812345${Math.floor(Math.random() * 100000)}` },
    });
    const profile = await prisma.studentProfile.create({ data: { userId: user.id } });
    return { user, profile };
  }

  let dateCounter = 0;
  function nextTuesday(): string {
    const date = new Date("2026-08-18T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() + dateCounter * 7);
    dateCounter += 1;
    return date.toISOString().slice(0, 10);
  }

  // Real POST /bookings (locks priceAmount) followed by the tutor's real
  // PATCH accept, so the resulting ACCEPTED booking exercises the exact
  // path production traffic would.
  async function createAcceptedBooking(firebaseUid: string, durationMinutes = 60) {
    const { user } = await createStudent(firebaseUid);
    verifyIdToken.mockResolvedValue({ uid: firebaseUid });
    const created = await request(app.getHttpServer())
      .post("/api/bookings")
      .set(...auth)
      .send({
        tutorId: tutorProfileId,
        startTime: "16:00",
        subjectId,
        scheduledDate: nextTuesday(),
        durationMinutes,
        mode: "ONLINE",
      })
      .expect(201);

    await tutorAuth();
    const accepted = await request(app.getHttpServer())
      .patch(`/api/bookings/${created.body.id}/accept`)
      .set(...auth)
      .expect(200);

    return { student: user, booking: accepted.body as { id: string; priceAmount: number } };
  }

  describe("booking price locking", () => {
    it("locks priceAmount from the tutor's rate at request time, unaffected by a later rate change", async () => {
      const { booking } = await createAcceptedBooking("e2e-payments-student-lock");
      expect(booking.priceAmount).toBe(100000); // 100000/hr * 60min

      await prisma.tutorProfile.update({ where: { id: tutorProfileId }, data: { hourlyRate: 500000 } });

      const reloaded = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(reloaded.priceAmount).toBe(100000);

      await prisma.tutorProfile.update({ where: { id: tutorProfileId }, data: { hourlyRate: 100000 } });
    });
  });

  describe("POST /bookings/:id/pay", () => {
    it("returns 403 for a role other than STUDENT", async () => {
      const { booking } = await createAcceptedBooking("e2e-payments-student-pay-role");
      await tutorAuth();
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/pay`)
        .set(...auth)
        .expect(403);
    });

    it("returns 403 for a student who did not request this booking", async () => {
      const { booking } = await createAcceptedBooking("e2e-payments-student-pay-wrong");
      const { user: stranger } = await createStudent("e2e-payments-student-pay-stranger");
      verifyIdToken.mockResolvedValue({ uid: stranger.firebaseUid });

      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/pay`)
        .set(...auth)
        .expect(403);
    });

    it("returns 400 for a booking that isn't ACCEPTED yet", async () => {
      const { user } = await createStudent("e2e-payments-student-pay-badstate");
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      const requested = await request(app.getHttpServer())
        .post("/api/bookings")
        .set(...auth)
        .send({
          tutorId: tutorProfileId,
          startTime: "16:00",
          subjectId,
          scheduledDate: nextTuesday(),
          durationMinutes: 60,
          mode: "ONLINE",
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/bookings/${requested.body.id}/pay`)
        .set(...auth)
        .expect(400);
    });

    it("creates a PENDING transaction then 503s since Midtrans isn't configured, reusing that transaction on retry", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-payments-student-pay-503");
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });

      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/pay`)
        .set(...auth)
        .expect(503);

      const transaction = await prisma.transaction.findUnique({ where: { bookingId: booking.id } });
      expect(transaction).not.toBeNull();
      expect(transaction!.status).toBe("PENDING");
      expect(transaction!.amount).toBe(100000);
      expect(transaction!.commission).toBe(15000); // default 15% of 100000

      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/pay`)
        .set(...auth)
        .expect(503);

      const count = await prisma.transaction.count({ where: { bookingId: booking.id } });
      expect(count).toBe(1);
    });
  });

  describe("GET /transactions", () => {
    it("scopes results to the requesting student or tutor, excluding others", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-payments-student-list");
      await prisma.transaction.create({
        data: { bookingId: booking.id, amount: 100000, commission: 15000, status: "PAID" },
      });

      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });
      const asStudent = await request(app.getHttpServer())
        .get("/api/transactions")
        .set(...auth)
        .expect(200);
      expect(asStudent.body.data.some((t: { bookingId: string }) => t.bookingId === booking.id)).toBe(
        true,
      );

      await tutorAuth();
      const asTutor = await request(app.getHttpServer())
        .get("/api/transactions")
        .set(...auth)
        .expect(200);
      expect(asTutor.body.data.some((t: { bookingId: string }) => t.bookingId === booking.id)).toBe(
        true,
      );

      const { user: stranger } = await createStudent("e2e-payments-student-list-stranger");
      verifyIdToken.mockResolvedValue({ uid: stranger.firebaseUid });
      const asStranger = await request(app.getHttpServer())
        .get("/api/transactions")
        .set(...auth)
        .expect(200);
      expect(
        asStranger.body.data.some((t: { bookingId: string }) => t.bookingId === booking.id),
      ).toBe(false);
    });
  });

  describe("POST /webhooks/midtrans", () => {
    it("503s since Midtrans isn't configured, even before looking at the payload", async () => {
      await request(app.getHttpServer())
        .post("/api/webhooks/midtrans")
        .send({
          order_id: "does-not-exist",
          status_code: "200",
          gross_amount: "100000.00",
          signature_key: "whatever",
          transaction_status: "settlement",
        })
        .expect(503);
    });
  });

  describe("payouts", () => {
    it("PATCH /tutors/me/bank-details sets bank details for the tutor", async () => {
      await tutorAuth();
      const res = await request(app.getHttpServer())
        .patch("/api/tutors/me/bank-details")
        .set(...auth)
        .send({ bankName: "BCA", bankAccountNumber: "1234567890", bankAccountHolderName: "Budi" })
        .expect(200);
      expect(res.body.bankName).toBe("BCA");
    });

    it("POST /payouts/request returns 400 when the requested amount exceeds available balance", async () => {
      await tutorAuth();
      await request(app.getHttpServer())
        .post("/api/payouts/request")
        .set(...auth)
        .send({ amount: 999_999_999 })
        .expect(400);
    });

    it("POST /payouts/request returns 400 below the minimum payout amount", async () => {
      await tutorAuth();
      await request(app.getHttpServer())
        .post("/api/payouts/request")
        .set(...auth)
        .send({ amount: 1000 })
        .expect(400);
    });

    it("creates a PENDING payout once there's enough available balance, then the admin can process it end to end", async () => {
      // Seed a COMPLETED booking with a PAID transaction so availableBalance > 0
      // (Task 5.4's rule: only COMPLETED-session transactions count as available).
      const { booking } = await createAcceptedBooking("e2e-payments-student-payout-flow");
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "COMPLETED" } });
      await prisma.transaction.create({
        data: { bookingId: booking.id, amount: 200000, commission: 30000, status: "PAID" },
      });

      await tutorAuth();
      const requested = await request(app.getHttpServer())
        .post("/api/payouts/request")
        .set(...auth)
        .send({ amount: 100000 })
        .expect(201);
      expect(requested.body.status).toBe("PENDING");
      expect(requested.body.bankName).toBe("BCA");

      const mine = await request(app.getHttpServer())
        .get("/api/payouts")
        .set(...auth)
        .expect(200);
      expect(mine.body.some((p: { id: string }) => p.id === requested.body.id)).toBe(true);

      // Non-admin can't see or process the pending queue.
      await request(app.getHttpServer())
        .get("/api/internal/payouts/pending")
        .set(...auth)
        .expect(403);

      await adminAuth();
      const pending = await request(app.getHttpServer())
        .get("/api/internal/payouts/pending")
        .set(...auth)
        .expect(200);
      expect(pending.body.some((p: { id: string }) => p.id === requested.body.id)).toBe(true);

      // Can't skip straight to COMPLETED from PENDING.
      await request(app.getHttpServer())
        .patch(`/api/internal/payouts/${requested.body.id}/status`)
        .set(...auth)
        .send({ status: "COMPLETED" })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/internal/payouts/${requested.body.id}/status`)
        .set(...auth)
        .send({ status: "PROCESSING" })
        .expect(200);

      const completed = await request(app.getHttpServer())
        .patch(`/api/internal/payouts/${requested.body.id}/status`)
        .set(...auth)
        .send({ status: "COMPLETED" })
        .expect(200);
      expect(completed.body.status).toBe("COMPLETED");
      expect(completed.body.processedAt).not.toBeNull();

      const notification = await prisma.notification.findFirst({
        where: { userId: tutorUserId, type: "PAYOUT_STATUS_CHANGED" },
        orderBy: { createdAt: "desc" },
      });
      expect(notification).not.toBeNull();
    });

    it("requires a failureReason when marking a payout FAILED", async () => {
      const { booking } = await createAcceptedBooking("e2e-payments-student-payout-fail");
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "COMPLETED" } });
      await prisma.transaction.create({
        data: { bookingId: booking.id, amount: 200000, commission: 30000, status: "PAID" },
      });

      await tutorAuth();
      const requested = await request(app.getHttpServer())
        .post("/api/payouts/request")
        .set(...auth)
        .send({ amount: 100000 })
        .expect(201);

      await adminAuth();
      await request(app.getHttpServer())
        .patch(`/api/internal/payouts/${requested.body.id}/status`)
        .set(...auth)
        .send({ status: "FAILED" })
        .expect(400);

      const failed = await request(app.getHttpServer())
        .patch(`/api/internal/payouts/${requested.body.id}/status`)
        .set(...auth)
        .send({ status: "FAILED", failureReason: "Nomor rekening tidak valid" })
        .expect(200);
      expect(failed.body.status).toBe("FAILED");
      expect(failed.body.failureReason).toBe("Nomor rekening tidak valid");
    });
  });

  describe("GET /tutors/me/earnings", () => {
    it("summarizes available/pending/total balances and lists payout history", async () => {
      const { booking: completedBooking } = await createAcceptedBooking(
        "e2e-payments-student-earnings-completed",
      );
      await prisma.booking.update({ where: { id: completedBooking.id }, data: { status: "COMPLETED" } });
      await prisma.transaction.create({
        data: { bookingId: completedBooking.id, amount: 100000, commission: 15000, status: "PAID" },
      });

      const { booking: confirmedBooking } = await createAcceptedBooking(
        "e2e-payments-student-earnings-confirmed",
      );
      await prisma.booking.update({ where: { id: confirmedBooking.id }, data: { status: "CONFIRMED" } });
      await prisma.transaction.create({
        data: { bookingId: confirmedBooking.id, amount: 100000, commission: 15000, status: "PAID" },
      });

      await tutorAuth();
      const res = await request(app.getHttpServer())
        .get("/api/tutors/me/earnings")
        .set(...auth)
        .expect(200);

      expect(res.body.totalEarned).toBeGreaterThanOrEqual(85000);
      expect(res.body.pendingBalance).toBeGreaterThanOrEqual(85000);
      expect(Array.isArray(res.body.payouts)).toBe(true);
    });

    it("GET /tutors/me/earnings/export returns a CSV with a header row", async () => {
      await tutorAuth();
      const res = await request(app.getHttpServer())
        .get("/api/tutors/me/earnings/export")
        .set(...auth)
        .expect(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text.split("\n")[0]).toBe(
        "Tanggal,Mata Pelajaran,Siswa,Bruto (IDR),Komisi (IDR),Bersih (IDR)",
      );
    });

    it("returns 403 for a non-tutor", async () => {
      const { user } = await createStudent("e2e-payments-student-earnings-403");
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
      await request(app.getHttpServer())
        .get("/api/tutors/me/earnings")
        .set(...auth)
        .expect(403);
    });
  });

  describe("disputes", () => {
    it("lets a participant raise a dispute and notifies the other party", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-payments-student-dispute-raise");
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/disputes`)
        .set(...auth)
        .send({ reason: "Tutor tidak hadir tanpa kabar" })
        .expect(201);
      expect(res.body.status).toBe("OPEN");

      const notification = await prisma.notification.findFirst({
        where: { userId: tutorUserId, type: "DISPUTE_RAISED" },
      });
      expect(notification).not.toBeNull();
    });

    it("rejects a non-participant raising a dispute", async () => {
      const { booking } = await createAcceptedBooking("e2e-payments-student-dispute-403");
      const { user: stranger } = await createStudent("e2e-payments-student-dispute-stranger");
      verifyIdToken.mockResolvedValue({ uid: stranger.firebaseUid });

      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/disputes`)
        .set(...auth)
        .send({ reason: "test" })
        .expect(403);
    });

    it("admin can resolve a dispute as RESOLVED_NO_REFUND without touching Midtrans", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-payments-student-dispute-norefund");
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });
      const dispute = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/disputes`)
        .set(...auth)
        .send({ reason: "Kualitas sesi kurang baik" })
        .expect(201);

      await adminAuth();
      const resolved = await request(app.getHttpServer())
        .patch(`/api/internal/disputes/${dispute.body.id}/resolve`)
        .set(...auth)
        .send({ status: "RESOLVED_NO_REFUND", resolutionNotes: "Tidak ada bukti pelanggaran" })
        .expect(200);
      expect(resolved.body.status).toBe("RESOLVED_NO_REFUND");
    });

    it("gates RESOLVED_REFUND behind Midtrans being configured, leaving the dispute OPEN on failure", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-payments-student-dispute-refund-503");
      await prisma.transaction.create({
        data: { bookingId: booking.id, amount: 100000, commission: 15000, status: "PAID", gatewayRef: "gw-1" },
      });
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });
      const dispute = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/disputes`)
        .set(...auth)
        .send({ reason: "Minta refund" })
        .expect(201);

      await adminAuth();
      await request(app.getHttpServer())
        .patch(`/api/internal/disputes/${dispute.body.id}/resolve`)
        .set(...auth)
        .send({ status: "RESOLVED_REFUND" })
        .expect(503);

      const reloaded = await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.body.id } });
      expect(reloaded.status).toBe("OPEN");
      const transaction = await prisma.transaction.findUniqueOrThrow({
        where: { bookingId: booking.id },
      });
      expect(transaction.status).toBe("PAID");
    });

    it("returns 403 for a non-admin hitting the internal disputes queue", async () => {
      const { student } = await createAcceptedBooking("e2e-payments-student-dispute-admin-403");
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });
      await request(app.getHttpServer())
        .get("/api/internal/disputes")
        .set(...auth)
        .expect(403);
    });
  });
});
