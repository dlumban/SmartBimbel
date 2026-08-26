import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseAdminService } from "../src/auth/firebase-admin.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { BookingExpiryProcessor } from "../src/bookings/processors/booking-expiry.processor";

// Exercises the real seeded dataset from prisma/seed.ts (6 tutors across
// Jakarta Selatan/Bandung/Surabaya/Yogyakarta/Medan, mixed verification
// statuses) rather than mocking Prisma - a query-builder this shaped is
// more usefully verified against real data than against asserted `where`
// object shapes.
describe("Tutor discovery (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseAdminService)
      .useValue({ verifyIdToken: jest.fn() })
      .overrideProvider(BookingExpiryProcessor)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("only returns verified tutors, excluding PENDING and REJECTED seed tutors", async () => {
    const res = await request(app.getHttpServer()).get("/api/tutors?limit=50").expect(200);
    const names = res.body.data.map((t: { name: string }) => t.name);
    expect(names).toContain("Budi Santoso");
    expect(names).not.toContain("Tono Pratama"); // PENDING
    expect(names).not.toContain("Dewi Lestari"); // REJECTED
  });

  it("paginates with a correct total count", async () => {
    const res = await request(app.getHttpServer()).get("/api/tutors?limit=2&page=1").expect(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(4); // at least the 4 verified seed tutors
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
  });

  it("filters by city", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/tutors?city=Surabaya&limit=50")
      .expect(200);
    expect(res.body.data.every((t: { city: string }) => t.city === "Surabaya")).toBe(true);
    expect(res.body.data.some((t: { name: string }) => t.name === "Andi Wijaya")).toBe(true);
  });

  it("filters by subject", async () => {
    const subject = await prisma.subject.findUniqueOrThrow({ where: { name: "Kimia" } });
    const res = await request(app.getHttpServer())
      .get(`/api/tutors?subjectId=${subject.id}&limit=50`)
      .expect(200);
    expect(res.body.data.some((t: { name: string }) => t.name === "Andi Wijaya")).toBe(true);
    expect(res.body.data.some((t: { name: string }) => t.name === "Sari Wulandari")).toBe(false);
  });

  it("filters by teaching mode", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/tutors?mode=OFFLINE&limit=50")
      .expect(200);
    // Sari Wulandari is ONLINE-only in the seed data.
    expect(res.body.data.some((t: { name: string }) => t.name === "Sari Wulandari")).toBe(false);
    expect(res.body.data.some((t: { name: string }) => t.name === "Andi Wijaya")).toBe(true);
  });

  it("filters by price range", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/tutors?priceMin=90000&priceMax=110000&limit=50")
      .expect(200);
    for (const t of res.body.data) {
      expect(t.hourlyRate).toBeGreaterThanOrEqual(90000);
      expect(t.hourlyRate).toBeLessThanOrEqual(110000);
    }
    expect(res.body.data.some((t: { name: string }) => t.name === "Andi Wijaya")).toBe(true); // 100000
  });

  it("rejects priceMin greater than priceMax", async () => {
    await request(app.getHttpServer())
      .get("/api/tutors?priceMin=200000&priceMax=100000")
      .expect(400);
  });

  it("searches by keyword against name and bio", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/tutors?q=Wulandari&limit=50")
      .expect(200);
    expect(res.body.data.some((t: { name: string }) => t.name === "Sari Wulandari")).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it("sorts by price ascending", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/tutors?sort=price&limit=50")
      .expect(200);
    const rates = res.body.data.map((t: { hourlyRate: number }) => t.hourlyRate);
    const sorted = [...rates].sort((a, b) => a - b);
    expect(rates).toEqual(sorted);
  });

  it("sorts by nearest to a given city and includes distanceKm", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/tutors?sort=nearest&near=Jakarta Selatan&limit=50")
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    // Rina and Budi are both in Jakarta Selatan - should be ~0km and sort first.
    expect(res.body.data[0].distanceKm).toBeLessThan(5);
    const distances = res.body.data.map((t: { distanceKm: number }) => t.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("rejects sort=nearest with an unsupported city", async () => {
    await request(app.getHttpServer())
      .get("/api/tutors?sort=nearest&near=Atlantis")
      .expect(400);
  });

  it("GET /tutors/:id returns full detail for a verified tutor", async () => {
    const list = await request(app.getHttpServer()).get("/api/tutors?q=Budi").expect(200);
    const id = list.body.data[0].id;

    const res = await request(app.getHttpServer()).get(`/api/tutors/${id}`).expect(200);
    expect(res.body.name).toBe("Budi Santoso");
    expect(res.body.subjects).toContain("Matematika");
    expect(res.body.education).toContain("Institut Teknologi Bandung");
    // subjectOptions carries the id alongside the name (Task 3.7) - the
    // booking flow needs the id to submit CreateBookingDto; `subjects`
    // alone (names-only) isn't enough for that.
    expect(
      res.body.subjectOptions.some((s: { name: string }) => s.name === "Matematika"),
    ).toBe(true);
    expect(res.body.subjectOptions[0]).toHaveProperty("id");
  });

  // No declared availability to show anymore (Task: half-hour calendar
  // scheduling) - this endpoint replaces it for the student-facing
  // booking flow: real busy times only, no student identity.
  describe("GET /tutors/:id/schedule", () => {
    it("is public (no auth) and returns an empty array for a tutor with no active bookings", async () => {
      const list = await request(app.getHttpServer()).get("/api/tutors?q=Budi").expect(200);
      const id = list.body.data[0].id;

      const res = await request(app.getHttpServer()).get(`/api/tutors/${id}/schedule`).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toEqual([]);
    });

    it("returns 404 for a nonexistent tutor id", async () => {
      await request(app.getHttpServer()).get("/api/tutors/does-not-exist/schedule").expect(404);
    });
  });

  it("GET /tutors/:id returns 404 for a nonexistent id", async () => {
    await request(app.getHttpServer()).get("/api/tutors/does-not-exist").expect(404);
  });

  it("GET /tutors/:id returns 404 for an unverified tutor (doesn't leak pending/rejected profiles)", async () => {
    const pendingUser = await prisma.user.findUniqueOrThrow({
      where: { firebaseUid: "seed-tutor-5" },
    });
    const pendingProfile = await prisma.tutorProfile.findUniqueOrThrow({
      where: { userId: pendingUser.id },
    });

    await request(app.getHttpServer()).get(`/api/tutors/${pendingProfile.id}`).expect(404);
  });
});
