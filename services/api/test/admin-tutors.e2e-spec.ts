import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseAdminService } from "../src/auth/firebase-admin.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { BookingExpiryProcessor } from "../src/bookings/processors/booking-expiry.processor";

describe("Admin tutor verification (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const verifyIdToken = jest.fn();
  let subjectId: string;
  let gradeLevelId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseAdminService)
      .useValue({ verifyIdToken })
      .overrideProvider(BookingExpiryProcessor)
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
    const gradeLevel = await prisma.gradeLevel.upsert({
      where: { name: "SMA 10-12" },
      update: {},
      create: { name: "SMA 10-12" },
    });
    subjectId = subject.id;
    gradeLevelId = gradeLevel.id;
  });

  afterAll(async () => {
    await prisma.tutorProfile.deleteMany({
      where: { user: { firebaseUid: { startsWith: "e2e-admin-" } } },
    });
    await prisma.auditLog.deleteMany({ where: { adminUser: { firebaseUid: { startsWith: "e2e-admin-" } } } });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: "e2e-admin-" } } });
    await app.close();
  });

  // Admins aren't self-service (see UsersService.setRole) - created directly,
  // matching how a real deployment would bootstrap its first admin.
  async function createAdmin(firebaseUid: string) {
    return prisma.user.create({
      data: { firebaseUid, role: "ADMIN", phone: `+62812340${Math.floor(Math.random() * 10000)}` },
    });
  }

  async function createSubmittedTutor(firebaseUid: string) {
    const user = await prisma.user.create({
      data: { firebaseUid, role: "TUTOR", phone: `+62812341${Math.floor(Math.random() * 10000)}` },
    });
    const profile = await prisma.tutorProfile.create({
      data: {
        userId: user.id,
        bio: "hi",
        education: "S1",
        hourlyRate: 100000,
        teachingModes: ["ONLINE"],
        city: "Jakarta",
        ktpDocumentPath: "tutor-documents/x/ktp.jpg",
        profileSubmittedAt: new Date(),
        subjects: { connect: [{ id: subjectId }] },
        gradeLevels: { connect: [{ id: gradeLevelId }] },
      },
    });
    return { user, profile };
  }

  it("returns 403 for a non-admin hitting the pending queue", async () => {
    const { user } = await createSubmittedTutor("e2e-admin-tutor-viewer");
    verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

    await request(app.getHttpServer())
      .get("/api/internal/tutors/pending")
      .set("Authorization", "Bearer good-token")
      .expect(403);
  });

  it("lists a submitted tutor in the pending queue", async () => {
    const admin = await createAdmin("e2e-admin-1");
    const { profile } = await createSubmittedTutor("e2e-admin-tutor-1");
    verifyIdToken.mockResolvedValue({ uid: admin.firebaseUid });

    const res = await request(app.getHttpServer())
      .get("/api/internal/tutors/pending")
      .set("Authorization", "Bearer good-token")
      .expect(200);

    expect(res.body.some((p: { id: string }) => p.id === profile.id)).toBe(true);
  });

  it("approves a tutor and removes them from the pending queue", async () => {
    const admin = await createAdmin("e2e-admin-2");
    const { profile } = await createSubmittedTutor("e2e-admin-tutor-2");
    verifyIdToken.mockResolvedValue({ uid: admin.firebaseUid });

    const res = await request(app.getHttpServer())
      .patch(`/api/internal/tutors/${profile.id}/verification`)
      .set("Authorization", "Bearer good-token")
      .send({ status: "VERIFIED" })
      .expect(200);
    expect(res.body.verificationStatus).toBe("VERIFIED");

    const queue = await request(app.getHttpServer())
      .get("/api/internal/tutors/pending")
      .set("Authorization", "Bearer good-token")
      .expect(200);
    expect(queue.body.some((p: { id: string }) => p.id === profile.id)).toBe(false);
  });

  it("rejects a tutor with a reason, visible on their own profile", async () => {
    const admin = await createAdmin("e2e-admin-3");
    const { profile, user: tutorUser } = await createSubmittedTutor("e2e-admin-tutor-3");
    verifyIdToken.mockResolvedValue({ uid: admin.firebaseUid });

    await request(app.getHttpServer())
      .patch(`/api/internal/tutors/${profile.id}/verification`)
      .set("Authorization", "Bearer good-token")
      .send({ status: "REJECTED", reason: "Dokumen KTP buram" })
      .expect(200);

    verifyIdToken.mockResolvedValue({ uid: tutorUser.firebaseUid });
    const res = await request(app.getHttpServer())
      .get("/api/tutors/me")
      .set("Authorization", "Bearer good-token")
      .expect(200);
    expect(res.body.verificationStatus).toBe("REJECTED");
    expect(res.body.rejectionReason).toBe("Dokumen KTP buram");
  });

  it("requires a reason when rejecting", async () => {
    const admin = await createAdmin("e2e-admin-4");
    const { profile } = await createSubmittedTutor("e2e-admin-tutor-4");
    verifyIdToken.mockResolvedValue({ uid: admin.firebaseUid });

    await request(app.getHttpServer())
      .patch(`/api/internal/tutors/${profile.id}/verification`)
      .set("Authorization", "Bearer good-token")
      .send({ status: "REJECTED" })
      .expect(400);
  });

  it("re-enters the queue after a rejected tutor resubmits", async () => {
    const admin = await createAdmin("e2e-admin-5");
    const { profile, user: tutorUser } = await createSubmittedTutor("e2e-admin-tutor-5");

    verifyIdToken.mockResolvedValue({ uid: admin.firebaseUid });
    await request(app.getHttpServer())
      .patch(`/api/internal/tutors/${profile.id}/verification`)
      .set("Authorization", "Bearer good-token")
      .send({ status: "REJECTED", reason: "Perbaiki foto KTP" })
      .expect(200);

    verifyIdToken.mockResolvedValue({ uid: tutorUser.firebaseUid });
    const resubmitted = await request(app.getHttpServer())
      .post("/api/tutors/profile/submit")
      .set("Authorization", "Bearer good-token")
      .expect(201);
    expect(resubmitted.body.verificationStatus).toBe("PENDING");
    expect(resubmitted.body.rejectionReason).toBeNull();

    verifyIdToken.mockResolvedValue({ uid: admin.firebaseUid });
    const queue = await request(app.getHttpServer())
      .get("/api/internal/tutors/pending")
      .set("Authorization", "Bearer good-token")
      .expect(200);
    expect(queue.body.some((p: { id: string }) => p.id === profile.id)).toBe(true);
  });

  describe("GET /internal/tutors/:id/documents/:type", () => {
    it("lets an admin view a real uploaded document without leaving the panel", async () => {
      const admin = await createAdmin("e2e-admin-6");
      const { profile, user: tutorUser } = await createSubmittedTutor("e2e-admin-tutor-6");

      verifyIdToken.mockResolvedValue({ uid: tutorUser.firebaseUid });
      await request(app.getHttpServer())
        .post("/api/tutors/me/documents/ktp")
        .set("Authorization", "Bearer good-token")
        .attach("file", Buffer.from("fake ktp bytes"), { filename: "ktp.jpg", contentType: "image/jpeg" })
        .expect(201);

      verifyIdToken.mockResolvedValue({ uid: admin.firebaseUid });
      const res = await request(app.getHttpServer())
        .get(`/api/internal/tutors/${profile.id}/documents/ktp`)
        .set("Authorization", "Bearer good-token")
        .expect(200);
      expect(res.body.toString()).toBe("fake ktp bytes");
    });

    it("returns 404 for a document type that was never uploaded", async () => {
      const admin = await createAdmin("e2e-admin-7");
      const { profile } = await createSubmittedTutor("e2e-admin-tutor-7");
      verifyIdToken.mockResolvedValue({ uid: admin.firebaseUid });

      await request(app.getHttpServer())
        .get(`/api/internal/tutors/${profile.id}/documents/diploma`)
        .set("Authorization", "Bearer good-token")
        .expect(404);
    });

    it("returns 403 for a non-admin", async () => {
      const { user, profile } = await createSubmittedTutor("e2e-admin-tutor-8");
      verifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

      await request(app.getHttpServer())
        .get(`/api/internal/tutors/${profile.id}/documents/ktp`)
        .set("Authorization", "Bearer good-token")
        .expect(403);
    });
  });
});
