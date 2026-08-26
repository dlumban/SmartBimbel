import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseAdminService } from "../src/auth/firebase-admin.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { BookingExpiryProcessor } from "../src/bookings/processors/booking-expiry.processor";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const verifyIdToken = jest.fn();

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
    // Mirrors main.ts's bootstrap - createNestApplication() doesn't run it
    // automatically, and without it DTO validation wouldn't be enforced.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { firebaseUid: { startsWith: "e2e-test-" } },
    });
    await app.close();
  });

  it("creates a new user on first session exchange", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "e2e-test-uid-1",
      phone_number: "+6281234599901",
      email: "e2e-1@example.com",
    });

    const res = await request(app.getHttpServer())
      .post("/api/auth/session")
      .send({ idToken: "fake-but-verified-by-mock" })
      .expect(201);

    expect(res.body.role).toBeNull();
    expect(res.body.phone).toBe("+6281234599901");

    const stored = await prisma.user.findUnique({
      where: { firebaseUid: "e2e-test-uid-1" },
    });
    expect(stored).not.toBeNull();
  });

  it("returns the same user id on a second call for the same firebase uid", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "e2e-test-uid-1",
      phone_number: "+6281234599901",
      email: "e2e-1@example.com",
    });

    const first = await request(app.getHttpServer())
      .post("/api/auth/session")
      .send({ idToken: "t1" });
    const second = await request(app.getHttpServer())
      .post("/api/auth/session")
      .send({ idToken: "t2" });

    expect(first.body.id).toBe(second.body.id);
  });

  it("rejects a missing idToken with a validation error", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/session")
      .send({})
      .expect(400);
  });

  it("returns 401 when Firebase rejects the token", async () => {
    verifyIdToken.mockRejectedValue(new Error("invalid token"));

    await request(app.getHttpServer())
      .post("/api/auth/session")
      .send({ idToken: "garbage" })
      .expect(401);
  });

  it("rate limits after repeated calls", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "e2e-test-uid-rate-limit",
      phone_number: "+6281234599902",
    });

    let sawTooManyRequests = false;
    for (let i = 0; i < 15; i++) {
      const res = await request(app.getHttpServer())
        .post("/api/auth/session")
        .send({ idToken: `t${i}` });
      if (res.status === 429) {
        sawTooManyRequests = true;
        break;
      }
    }

    expect(sawTooManyRequests).toBe(true);
  });
});
