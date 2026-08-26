import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import * as crypto from "crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseAdminService } from "../src/auth/firebase-admin.service";
import { MidtransService } from "../src/payments/midtrans.service";
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

// No real Midtrans credentials exist in this environment, so the
// pay -> webhook -> CONFIRMED flow (and the refund flow) can only be
// exercised end to end against a deterministic fake MidtransService - it
// implements the exact same signature algorithm the real service does
// (Task 5.1) so the webhook handler's signature-verification logic is
// still genuinely tested, without ever making a real network call.
describe("Payments webhook flow (e2e, fake Midtrans)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const verifyIdToken = jest.fn();
  const auth = ["Authorization", "Bearer good-token"] as const;
  const FAKE_SERVER_KEY = "fake-server-key-for-e2e-only";

  const fakeMidtrans = {
    isConfigured: () => true,
    createSnapTransaction: jest.fn().mockResolvedValue({
      token: "fake-snap-token",
      redirectUrl: "https://fake.midtrans.example/redirect",
    }),
    verifySignature: (params: {
      orderId: string;
      statusCode: string;
      grossAmount: string;
      signatureKey: string;
    }) => {
      const expected = crypto
        .createHash("sha512")
        .update(params.orderId + params.statusCode + params.grossAmount + FAKE_SERVER_KEY)
        .digest("hex");
      return expected === params.signatureKey;
    },
    refund: jest.fn().mockResolvedValue({ status_code: "200", refund_amount: "100000" }),
  };

  function signatureFor(orderId: string, statusCode: string, grossAmount: string): string {
    return crypto
      .createHash("sha512")
      .update(orderId + statusCode + grossAmount + FAKE_SERVER_KEY)
      .digest("hex");
  }

  let tutorProfileId: string;
  let tutorUserId: string;
  let subjectId: string;
  const autoCompleteQueueAdd = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseAdminService)
      .useValue({ verifyIdToken })
      .overrideProvider(MidtransService)
      .useValue(fakeMidtrans)
      .overrideProvider(getQueueToken(BOOKING_EXPIRY_QUEUE))
      .useValue({ add: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(getQueueToken(SESSION_REMINDER_QUEUE))
      .useValue({ add: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(getQueueToken(PAYMENT_EXPIRY_QUEUE))
      .useValue({ add: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(getQueueToken(SESSION_AUTO_COMPLETE_QUEUE))
      .useValue({ add: autoCompleteQueueAdd })
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
      data: { firebaseUid: "e2e-paywebhook-tutor-1", role: "TUTOR", phone: "+6281234581001" },
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
      data: { firebaseUid: "e2e-paywebhook-admin-1", role: "ADMIN", phone: "+6281234581099" },
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
            { firebaseUid: "e2e-paywebhook-tutor-1" },
            { firebaseUid: "e2e-paywebhook-admin-1" },
            { firebaseUid: { startsWith: "e2e-paywebhook-student" } },
          ],
        },
      },
    });
    await prisma.booking.deleteMany({ where: { tutorId: tutorProfileId } });
    await prisma.tutorProfile.deleteMany({ where: { id: tutorProfileId } });
    await prisma.user.deleteMany({ where: { firebaseUid: "e2e-paywebhook-tutor-1" } });
    await prisma.auditLog.deleteMany({ where: { adminUser: { firebaseUid: "e2e-paywebhook-admin-1" } } });
    await prisma.user.deleteMany({ where: { firebaseUid: "e2e-paywebhook-admin-1" } });
    await prisma.studentProfile.deleteMany({
      where: { user: { firebaseUid: { startsWith: "e2e-paywebhook-student" } } },
    });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: "e2e-paywebhook-student" } } });
    await app.close();
  });

  async function tutorAuth() {
    verifyIdToken.mockResolvedValue({ uid: "e2e-paywebhook-tutor-1" });
  }

  async function adminAuth() {
    verifyIdToken.mockResolvedValue({ uid: "e2e-paywebhook-admin-1" });
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

  async function createAcceptedBooking(firebaseUid: string) {
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
        durationMinutes: 60,
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

  async function payFor(studentFirebaseUid: string, bookingId: string) {
    verifyIdToken.mockResolvedValue({ uid: studentFirebaseUid });
    return request(app.getHttpServer())
      .post(`/api/bookings/${bookingId}/pay`)
      .set(...auth)
      .expect(201);
  }

  describe("POST /bookings/:id/pay", () => {
    it("returns a Snap token/redirectUrl and creates a PENDING transaction with the correct commission", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-paywebhook-student-pay");
      const res = await payFor(student.firebaseUid!, booking.id);

      expect(res.body.token).toBe("fake-snap-token");
      expect(res.body.redirectUrl).toBe("https://fake.midtrans.example/redirect");

      const transaction = await prisma.transaction.findUniqueOrThrow({
        where: { bookingId: booking.id },
      });
      expect(transaction.status).toBe("PENDING");
      expect(transaction.amount).toBe(100000);
      expect(transaction.commission).toBe(15000);
    });
  });

  describe("full flow: pay -> webhook settlement -> CONFIRMED", () => {
    it("transitions the transaction to PAID and the booking to CONFIRMED, notifying both parties", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-paywebhook-student-settle");
      const pay = await payFor(student.firebaseUid!, booking.id);
      const orderId = pay.body.transactionId as string;

      const statusCode = "200";
      const grossAmount = "100000.00";
      await request(app.getHttpServer())
        .post("/api/webhooks/midtrans")
        .send({
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          signature_key: signatureFor(orderId, statusCode, grossAmount),
          transaction_status: "settlement",
          transaction_id: "midtrans-txn-abc",
        })
        .expect(200);

      const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: orderId } });
      expect(transaction.status).toBe("PAID");
      expect(transaction.gatewayRef).toBe("midtrans-txn-abc");
      expect(transaction.paidAt).not.toBeNull();

      const reloadedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(reloadedBooking.status).toBe("CONFIRMED");

      const history = await prisma.bookingStatusHistory.findFirst({
        where: { bookingId: booking.id, toStatus: "CONFIRMED" },
      });
      expect(history).not.toBeNull();

      const studentUser = await prisma.user.findUniqueOrThrow({
        where: { firebaseUid: student.firebaseUid! },
      });
      const studentNotif = await prisma.notification.findFirst({
        where: { userId: studentUser.id, type: "BOOKING_CONFIRMED" },
      });
      const tutorNotif = await prisma.notification.findFirst({
        where: { userId: tutorUserId, type: "BOOKING_CONFIRMED" },
      });
      expect(studentNotif).not.toBeNull();
      expect(tutorNotif).not.toBeNull();

      // Sprint 6's auto-complete safety net is scheduled the moment a
      // booking is actually confirmed (paid), not at acceptance time.
      expect(autoCompleteQueueAdd).toHaveBeenCalledWith(
        "auto-complete-session",
        { bookingId: booking.id },
        { delay: expect.any(Number) },
      );
    });

    it("is idempotent: replaying the same settlement webhook doesn't reprocess or duplicate notifications", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-paywebhook-student-idempotent");
      const pay = await payFor(student.firebaseUid!, booking.id);
      const orderId = pay.body.transactionId as string;
      const statusCode = "200";
      const grossAmount = "100000.00";
      const payload = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signatureFor(orderId, statusCode, grossAmount),
        transaction_status: "settlement",
        transaction_id: "midtrans-txn-replay",
      };

      await request(app.getHttpServer()).post("/api/webhooks/midtrans").send(payload).expect(200);
      await request(app.getHttpServer()).post("/api/webhooks/midtrans").send(payload).expect(200);
      await request(app.getHttpServer()).post("/api/webhooks/midtrans").send(payload).expect(200);

      const studentUser = await prisma.user.findUniqueOrThrow({
        where: { firebaseUid: student.firebaseUid! },
      });
      const notifCount = await prisma.notification.count({
        where: { userId: studentUser.id, type: "BOOKING_CONFIRMED" },
      });
      expect(notifCount).toBe(1);
    });

    it("rejects a webhook with an invalid signature and leaves the transaction untouched", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-paywebhook-student-badsig");
      const pay = await payFor(student.firebaseUid!, booking.id);
      const orderId = pay.body.transactionId as string;

      await request(app.getHttpServer())
        .post("/api/webhooks/midtrans")
        .send({
          order_id: orderId,
          status_code: "200",
          gross_amount: "100000.00",
          signature_key: "totally-wrong-signature",
          transaction_status: "settlement",
        })
        .expect(401);

      const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: orderId } });
      expect(transaction.status).toBe("PENDING");
    });

    it("marks the transaction FAILED and notifies the student on a deny/cancel/expire status", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-paywebhook-student-deny");
      const pay = await payFor(student.firebaseUid!, booking.id);
      const orderId = pay.body.transactionId as string;
      const statusCode = "202";
      const grossAmount = "100000.00";

      await request(app.getHttpServer())
        .post("/api/webhooks/midtrans")
        .send({
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          signature_key: signatureFor(orderId, statusCode, grossAmount),
          transaction_status: "deny",
        })
        .expect(200);

      const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: orderId } });
      expect(transaction.status).toBe("FAILED");

      const reloadedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(reloadedBooking.status).toBe("ACCEPTED"); // unchanged - only the webhook confirms

      const studentUser = await prisma.user.findUniqueOrThrow({
        where: { firebaseUid: student.firebaseUid! },
      });
      const notification = await prisma.notification.findFirst({
        where: { userId: studentUser.id, type: "PAYMENT_FAILED" },
      });
      expect(notification).not.toBeNull();
    });

    it("treats a still-pending VA/QRIS status as a genuine no-op", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-paywebhook-student-pending");
      const pay = await payFor(student.firebaseUid!, booking.id);
      const orderId = pay.body.transactionId as string;
      const statusCode = "201";
      const grossAmount = "100000.00";

      await request(app.getHttpServer())
        .post("/api/webhooks/midtrans")
        .send({
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          signature_key: signatureFor(orderId, statusCode, grossAmount),
          transaction_status: "pending",
        })
        .expect(200);

      const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: orderId } });
      expect(transaction.status).toBe("PENDING");
    });
  });

  describe("dispute RESOLVED_REFUND with a working gateway", () => {
    it("calls midtrans.refund, marks the transaction REFUNDED, and notifies both parties", async () => {
      const { student, booking } = await createAcceptedBooking("e2e-paywebhook-student-refund");
      const pay = await payFor(student.firebaseUid!, booking.id);
      const orderId = pay.body.transactionId as string;
      const statusCode = "200";
      const grossAmount = "100000.00";
      await request(app.getHttpServer())
        .post("/api/webhooks/midtrans")
        .send({
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          signature_key: signatureFor(orderId, statusCode, grossAmount),
          transaction_status: "settlement",
          transaction_id: "midtrans-txn-refundme",
        })
        .expect(200);

      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });
      const dispute = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/disputes`)
        .set(...auth)
        .send({ reason: "Tutor tidak memenuhi janji sesi" })
        .expect(201);

      fakeMidtrans.refund.mockClear();
      await adminAuth();
      const resolved = await request(app.getHttpServer())
        .patch(`/api/internal/disputes/${dispute.body.id}/resolve`)
        .set(...auth)
        .send({ status: "RESOLVED_REFUND", resolutionNotes: "Bukti kuat, refund penuh" })
        .expect(200);
      expect(resolved.body.status).toBe("RESOLVED_REFUND");

      expect(fakeMidtrans.refund).toHaveBeenCalledWith(
        "midtrans-txn-refundme",
        100000,
        "Bukti kuat, refund penuh",
      );

      const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: orderId } });
      expect(transaction.status).toBe("REFUNDED");
      expect(transaction.refundedAmount).toBe(100000);

      const studentUser = await prisma.user.findUniqueOrThrow({
        where: { firebaseUid: student.firebaseUid! },
      });
      const studentNotif = await prisma.notification.findFirst({
        where: { userId: studentUser.id, type: "DISPUTE_RESOLVED" },
      });
      const tutorNotif = await prisma.notification.findFirst({
        where: { userId: tutorUserId, type: "DISPUTE_RESOLVED" },
      });
      expect(studentNotif).not.toBeNull();
      expect(tutorNotif).not.toBeNull();
    });
  });
});
