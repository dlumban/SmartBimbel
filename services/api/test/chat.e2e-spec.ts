import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseAdminService } from "../src/auth/firebase-admin.service";
import { PrismaService } from "../src/prisma/prisma.service";

// Stream Chat isn't provisioned in this environment (no STREAM_API_KEY/
// STREAM_API_SECRET) - so token generation genuinely 503s here, which is
// itself worth verifying (it should 503 only *after* confirming the
// requester is a participant, never before). Message send/list/report/
// block all run against our own Postgres-backed Message/MessageReport/
// ConversationBlock tables regardless of Stream, so those are fully live.
describe("Chat (e2e)", () => {
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
      data: { firebaseUid: "e2e-chat-tutor-1", role: "TUTOR", phone: "+6281234570001" },
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
  });

  afterAll(async () => {
    await prisma.conversationBlock.deleteMany({ where: { conversation: { booking: { tutorId: tutorProfileId } } } });
    await prisma.messageReport.deleteMany({ where: { conversation: { booking: { tutorId: tutorProfileId } } } });
    await prisma.message.deleteMany({ where: { conversation: { booking: { tutorId: tutorProfileId } } } });
    await prisma.bookingStatusHistory.deleteMany({ where: { booking: { tutorId: tutorProfileId } } });
    await prisma.conversation.deleteMany({ where: { booking: { tutorId: tutorProfileId } } });
    await prisma.notification.deleteMany({
      where: {
        user: {
          OR: [
            { firebaseUid: "e2e-chat-tutor-1" },
            { firebaseUid: { startsWith: "e2e-chat-student" } },
          ],
        },
      },
    });
    await prisma.booking.deleteMany({ where: { tutorId: tutorProfileId } });
    await prisma.tutorProfile.deleteMany({ where: { id: tutorProfileId } });
    await prisma.user.deleteMany({ where: { firebaseUid: "e2e-chat-tutor-1" } });
    await prisma.studentProfile.deleteMany({
      where: { user: { firebaseUid: { startsWith: "e2e-chat-student" } } },
    });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: "e2e-chat-student" } } });
    await app.close();
  });

  async function tutorAuth() {
    verifyIdToken.mockResolvedValue({ uid: "e2e-chat-tutor-1" });
  }

  // Every call goes through the real POST /bookings (needed to trigger
  // Conversation creation) against the same recurring Tuesday slot - each
  // needs a distinct occurrence date or the active-booking conflict check
  // from Task 3.2 would reject every call after the first.
  let bookingDateCounter = 0;
  function nextTuesday(): string {
    const date = new Date("2026-08-18T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() + bookingDateCounter * 7);
    bookingDateCounter += 1;
    return date.toISOString().slice(0, 10);
  }

  async function createBookingWithConversation(firebaseUid: string) {
    const student = await prisma.user.create({
      data: { firebaseUid, role: "STUDENT", phone: `+62812345${Math.floor(Math.random() * 100000)}` },
    });
    await prisma.studentProfile.create({ data: { userId: student.id } });
    verifyIdToken.mockResolvedValue({ uid: firebaseUid });
    const booking = await request(app.getHttpServer())
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
      .then((res) => res.body);
    return { student, booking };
  }

  it("creates a Conversation automatically when a booking is submitted", async () => {
    const { booking } = await createBookingWithConversation("e2e-chat-student-auto-convo");

    const conversation = await prisma.conversation.findUnique({ where: { bookingId: booking.id } });
    expect(conversation).not.toBeNull();
  });

  describe("GET /bookings/:id/chat/token", () => {
    it("returns 403 for a non-participant before ever touching Stream", async () => {
      const { booking } = await createBookingWithConversation("e2e-chat-student-token-403");
      const stranger = await prisma.user.create({
        data: { firebaseUid: "e2e-chat-student-stranger", role: "STUDENT", phone: "+6281234570099" },
      });
      await prisma.studentProfile.create({ data: { userId: stranger.id } });
      verifyIdToken.mockResolvedValue({ uid: stranger.firebaseUid });

      await request(app.getHttpServer())
        .get(`/api/bookings/${booking.id}/chat/token`)
        .set(...auth)
        .expect(403);
    });

    it("returns 503 for a genuine participant since Stream isn't configured in this environment", async () => {
      const { student, booking } = await createBookingWithConversation("e2e-chat-student-token-503");
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });

      await request(app.getHttpServer())
        .get(`/api/bookings/${booking.id}/chat/token`)
        .set(...auth)
        .expect(503);
    });
  });

  describe("messages", () => {
    it("lets a participant send a message and lists it back in history", async () => {
      const { student, booking } = await createBookingWithConversation("e2e-chat-student-send");
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });

      const sendRes = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/messages`)
        .set(...auth)
        .send({ body: "Halo, boleh mulai jam 4?" })
        .expect(201);
      expect(sendRes.body.body).toBe("Halo, boleh mulai jam 4?");

      const listRes = await request(app.getHttpServer())
        .get(`/api/bookings/${booking.id}/messages`)
        .set(...auth)
        .expect(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].body).toBe("Halo, boleh mulai jam 4?");
    });

    it("notifies the recipient when a message is sent", async () => {
      const { student, booking } = await createBookingWithConversation("e2e-chat-student-notify");
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });

      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/messages`)
        .set(...auth)
        .send({ body: "Hi tutor" })
        .expect(201);

      const notification = await prisma.notification.findFirst({
        where: { userId: tutorUserId, type: "MESSAGE_RECEIVED" },
      });
      expect(notification).not.toBeNull();
    });

    it("rejects a non-participant trying to send a message", async () => {
      const { booking } = await createBookingWithConversation("e2e-chat-student-send-403");
      const stranger = await prisma.user.create({
        data: { firebaseUid: "e2e-chat-student-send-stranger", role: "STUDENT", phone: "+6281234570098" },
      });
      await prisma.studentProfile.create({ data: { userId: stranger.id } });
      verifyIdToken.mockResolvedValue({ uid: stranger.firebaseUid });

      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/messages`)
        .set(...auth)
        .send({ body: "sneaky" })
        .expect(403);
    });

    it("rejects an empty message body", async () => {
      const { student, booking } = await createBookingWithConversation("e2e-chat-student-empty");
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });

      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/messages`)
        .set(...auth)
        .send({ body: "" })
        .expect(400);
    });
  });

  describe("report / block (Task 4.4)", () => {
    it("lets a participant report a specific message", async () => {
      const { student, booking } = await createBookingWithConversation("e2e-chat-student-report-msg");
      await tutorAuth();
      const tutorMessage = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/messages`)
        .set(...auth)
        .send({ body: "Kirim uang ke rekening pribadi saya ya" })
        .expect(201);

      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/messages/${tutorMessage.body.id}/report`)
        .set(...auth)
        .send({ reason: "Meminta pembayaran di luar platform" })
        .expect(201);

      const report = await prisma.messageReport.findFirst({
        where: { messageId: tutorMessage.body.id },
      });
      expect(report).not.toBeNull();
      expect(report!.reportedUserId).toBe(tutorUserId);
    });

    it("rejects reporting your own message", async () => {
      const { student, booking } = await createBookingWithConversation("e2e-chat-student-report-self");
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });
      const ownMessage = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/messages`)
        .set(...auth)
        .send({ body: "hi" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/messages/${ownMessage.body.id}/report`)
        .set(...auth)
        .send({ reason: "test" })
        .expect(400);
    });

    it("lets a participant report the other party generally, with no message", async () => {
      const { student, booking } = await createBookingWithConversation("e2e-chat-student-report-user");
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });

      const res = await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/report`)
        .set(...auth)
        .send({ reason: "Perilaku tidak pantas" })
        .expect(201);

      expect(res.body.messageId).toBeNull();
      expect(res.body.reportedUserId).toBe(tutorUserId);
    });

    it("blocks a user from sending further messages once blocked", async () => {
      const { student, booking } = await createBookingWithConversation("e2e-chat-student-block");

      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/block`)
        .set(...auth)
        .expect(201);

      await tutorAuth();
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/messages`)
        .set(...auth)
        .send({ body: "let me back in" })
        .expect(403);

      // The blocking party can still send messages themselves.
      verifyIdToken.mockResolvedValue({ uid: student.firebaseUid });
      await request(app.getHttpServer())
        .post(`/api/bookings/${booking.id}/messages`)
        .set(...auth)
        .send({ body: "still works for me" })
        .expect(201);
    });
  });

  describe("POST /chat/webhook", () => {
    it("mirrors a message.new event into our own Message table and notifies the recipient", async () => {
      const { student, booking } = await createBookingWithConversation("e2e-chat-student-webhook");
      const conversation = await prisma.conversation.update({
        where: { bookingId: booking.id },
        data: { streamChannelId: "messaging:webhook-test-channel" },
      });

      await request(app.getHttpServer())
        .post("/api/chat/webhook")
        .send({
          type: "message.new",
          cid: "messaging:webhook-test-channel",
          message: { id: "stream-msg-e2e-1", text: "Hello from Stream", user: { id: student.id } },
        })
        .expect(200);

      const message = await prisma.message.findUnique({
        where: { streamMessageId: "stream-msg-e2e-1" },
      });
      expect(message).not.toBeNull();
      expect(message!.conversationId).toBe(conversation.id);

      const notification = await prisma.notification.findFirst({
        where: { userId: tutorUserId, type: "MESSAGE_RECEIVED" },
      });
      expect(notification).not.toBeNull();
    });

    it("ignores an event for an unknown channel without error", async () => {
      await request(app.getHttpServer())
        .post("/api/chat/webhook")
        .send({
          type: "message.new",
          cid: "messaging:does-not-exist",
          message: { id: "stream-msg-e2e-2", text: "hi", user: { id: "nobody" } },
        })
        .expect(200);
    });

    it("skips signature verification (and still succeeds) when Stream isn't configured", async () => {
      await request(app.getHttpServer())
        .post("/api/chat/webhook")
        .send({ type: "user.updated" })
        .expect(200);
    });
  });
});
