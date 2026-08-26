import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseAdminService } from "../src/auth/firebase-admin.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { BookingExpiryProcessor } from "../src/bookings/processors/booking-expiry.processor";

describe("Tutors (e2e)", () => {
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
      where: { user: { firebaseUid: { startsWith: "e2e-tutors-" } } },
    });
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: "e2e-tutors-" } } });
    await app.close();
  });

  async function createUser(firebaseUid: string, role: "STUDENT" | "TUTOR" | null) {
    return prisma.user.create({
      data: {
        firebaseUid,
        phone: `+62812345${Math.floor(Math.random() * 100000)}`,
        role,
      },
    });
  }

  it("returns 403 for a STUDENT trying to write a tutor profile", async () => {
    await createUser("e2e-tutors-student-1", "STUDENT");
    verifyIdToken.mockResolvedValue({ uid: "e2e-tutors-student-1" });

    await request(app.getHttpServer())
      .put("/api/tutors/profile")
      .set("Authorization", "Bearer good-token")
      .send({ bio: "hi" })
      .expect(403);
  });

  it("builds a profile across multiple PUT calls (multi-step form)", async () => {
    await createUser("e2e-tutors-tutor-1", "TUTOR");
    verifyIdToken.mockResolvedValue({ uid: "e2e-tutors-tutor-1" });
    const auth = ["Authorization", "Bearer good-token"] as const;

    await request(app.getHttpServer())
      .put("/api/tutors/profile")
      .set(...auth)
      .send({ bio: "Pengajar berpengalaman", education: "S1 Matematika ITB" })
      .expect(200);

    await request(app.getHttpServer())
      .put("/api/tutors/profile")
      .set(...auth)
      .send({ subjectIds: [subjectId], gradeLevelIds: [gradeLevelId] })
      .expect(200);

    const res = await request(app.getHttpServer())
      .put("/api/tutors/profile")
      .set(...auth)
      .send({ hourlyRate: 150000, teachingModes: ["ONLINE"], city: "Jakarta Selatan" })
      .expect(200);

    expect(res.body.bio).toBe("Pengajar berpengalaman");
    expect(res.body.subjects).toHaveLength(1);
    expect(res.body.hourlyRate).toBe(150000);
  });

  it("rejects submission until a KTP document is uploaded", async () => {
    verifyIdToken.mockResolvedValue({ uid: "e2e-tutors-tutor-1" });
    await request(app.getHttpServer())
      .post("/api/tutors/profile/submit")
      .set("Authorization", "Bearer good-token")
      .expect(400);
  });

  it("uploads a KTP document and can read it back", async () => {
    verifyIdToken.mockResolvedValue({ uid: "e2e-tutors-tutor-1" });
    const auth = ["Authorization", "Bearer good-token"] as const;

    await request(app.getHttpServer())
      .post("/api/tutors/me/documents/ktp")
      .set(...auth)
      .attach("file", Buffer.from("fake-ktp-bytes"), {
        filename: "ktp.jpg",
        contentType: "image/jpeg",
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get("/api/tutors/me/documents/ktp")
      .set(...auth)
      .expect(200);

    expect(res.body.toString()).toBe("fake-ktp-bytes");
  });

  it("rejects an unsupported document mime type", async () => {
    verifyIdToken.mockResolvedValue({ uid: "e2e-tutors-tutor-1" });
    await request(app.getHttpServer())
      .post("/api/tutors/me/documents/ktp")
      .set("Authorization", "Bearer good-token")
      .attach("file", Buffer.from("not-an-image"), {
        filename: "malware.exe",
        contentType: "application/x-msdownload",
      })
      .expect(400);
  });

  it("submits successfully once the profile and KTP are both complete", async () => {
    verifyIdToken.mockResolvedValue({ uid: "e2e-tutors-tutor-1" });
    const res = await request(app.getHttpServer())
      .post("/api/tutors/profile/submit")
      .set("Authorization", "Bearer good-token")
      .expect(201);

    expect(res.body.profileSubmittedAt).not.toBeNull();
  });
});
