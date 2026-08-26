import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseAdminService } from "../src/auth/firebase-admin.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { BookingExpiryProcessor } from "../src/bookings/processors/booking-expiry.processor";

describe("Students (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const verifyIdToken = jest.fn();
  let gradeLevelId: string;
  let subjectId: string;

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

    const gradeLevel = await prisma.gradeLevel.upsert({
      where: { name: "SMA 10-12" },
      update: {},
      create: { name: "SMA 10-12" },
    });
    const subject = await prisma.subject.upsert({
      where: { name: "Matematika" },
      update: {},
      create: { name: "Matematika" },
    });
    gradeLevelId = gradeLevel.id;
    subjectId = subject.id;
  });

  afterAll(async () => {
    await prisma.studentProfile.deleteMany({
      where: { user: { firebaseUid: { startsWith: "e2e-students-" } } },
    });
    await prisma.user.deleteMany({
      where: { firebaseUid: { startsWith: "e2e-students-" } },
    });
    await app.close();
  });

  async function createUser(firebaseUid: string, role: "STUDENT" | "TUTOR" | null) {
    return prisma.user.create({
      data: { firebaseUid, phone: `+62812345${Math.floor(Math.random() * 100000)}`, role },
    });
  }

  it("returns 403 for a TUTOR trying to create a student profile", async () => {
    await createUser("e2e-students-tutor-1", "TUTOR");
    verifyIdToken.mockResolvedValue({ uid: "e2e-students-tutor-1" });

    await request(app.getHttpServer())
      .post("/api/students/profile")
      .set("Authorization", "Bearer good-token")
      .send({ gradeLevelId, subjectIds: [subjectId] })
      .expect(403);
  });

  it("creates a profile for a STUDENT and rejects a duplicate", async () => {
    await createUser("e2e-students-student-1", "STUDENT");
    verifyIdToken.mockResolvedValue({ uid: "e2e-students-student-1" });

    const res = await request(app.getHttpServer())
      .post("/api/students/profile")
      .set("Authorization", "Bearer good-token")
      .send({
        gradeLevelId,
        subjectIds: [subjectId],
        preferredLocation: "Jakarta Selatan",
        preferredMode: "ONLINE",
      })
      .expect(201);

    expect(res.body.gradeLevel.id).toBe(gradeLevelId);
    expect(res.body.subjectsOfInterest).toHaveLength(1);

    await request(app.getHttpServer())
      .post("/api/students/profile")
      .set("Authorization", "Bearer good-token")
      .send({ gradeLevelId, subjectIds: [subjectId] })
      .expect(409);
  });

  it("rejects an unknown gradeLevelId with 400", async () => {
    await createUser("e2e-students-student-2", "STUDENT");
    verifyIdToken.mockResolvedValue({ uid: "e2e-students-student-2" });

    await request(app.getHttpServer())
      .post("/api/students/profile")
      .set("Authorization", "Bearer good-token")
      .send({ gradeLevelId: "does-not-exist", subjectIds: [subjectId] })
      .expect(400);
  });

  it("GET /students/me returns the created profile", async () => {
    verifyIdToken.mockResolvedValue({ uid: "e2e-students-student-1" });
    const res = await request(app.getHttpServer())
      .get("/api/students/me")
      .set("Authorization", "Bearer good-token")
      .expect(200);
    expect(res.body.preferredLocation).toBe("Jakarta Selatan");
  });

  it("PATCH /students/me updates only the provided field", async () => {
    verifyIdToken.mockResolvedValue({ uid: "e2e-students-student-1" });
    const res = await request(app.getHttpServer())
      .patch("/api/students/me")
      .set("Authorization", "Bearer good-token")
      .send({ preferredLocation: "Bandung" })
      .expect(200);
    expect(res.body.preferredLocation).toBe("Bandung");
    expect(res.body.gradeLevel.id).toBe(gradeLevelId);
  });

  describe("GET /students (tutor's student picker)", () => {
    it("returns 403 for a STUDENT (method-level @Roles(TUTOR) overrides the class default)", async () => {
      verifyIdToken.mockResolvedValue({ uid: "e2e-students-student-1" });
      await request(app.getHttpServer())
        .get("/api/students")
        .set("Authorization", "Bearer good-token")
        .expect(403);
    });

    it("lets a TUTOR list students, and filter by name/phone/email substring", async () => {
      const student = await createUser("e2e-students-list-target", "STUDENT");
      await prisma.user.update({
        where: { id: student.id },
        data: { name: "Siti Rahma", email: "siti.list@example.com" },
      });
      await prisma.studentProfile.create({ data: { userId: student.id } });
      await createUser("e2e-students-list-tutor", "TUTOR");
      verifyIdToken.mockResolvedValue({ uid: "e2e-students-list-tutor" });

      // Unfiltered list shape only - other e2e suites share this live DB
      // and create their own STUDENT fixtures, so which page ours lands on
      // isn't reliable; the filtered query below is the real existence check.
      const all = await request(app.getHttpServer())
        .get("/api/students")
        .set("Authorization", "Bearer good-token")
        .expect(200);
      expect(all.body).toMatchObject({ page: 1, limit: 20 });
      expect(Array.isArray(all.body.data)).toBe(true);

      // Partial/fuzzy match is intentional here (unlike the old exact-only
      // lookup) - a substring of the name is enough to find them.
      const filtered = await request(app.getHttpServer())
        .get("/api/students")
        .query({ q: "siti" })
        .set("Authorization", "Bearer good-token")
        .expect(200);
      expect(filtered.body.data).toHaveLength(1);
      expect(filtered.body.data[0]).toMatchObject({ userId: student.id, name: "Siti Rahma" });
    });

    it("returns an empty page for a filter matching no one", async () => {
      verifyIdToken.mockResolvedValue({ uid: "e2e-students-list-tutor" });
      const res = await request(app.getHttpServer())
        .get("/api/students")
        .query({ q: "no-such-student-xyz" })
        .set("Authorization", "Bearer good-token")
        .expect(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it("paginates with page/limit", async () => {
      verifyIdToken.mockResolvedValue({ uid: "e2e-students-list-tutor" });
      const res = await request(app.getHttpServer())
        .get("/api/students")
        .query({ q: "siti", page: 1, limit: 1 })
        .set("Authorization", "Bearer good-token")
        .expect(200);
      expect(res.body).toMatchObject({ page: 1, limit: 1 });
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });
});
