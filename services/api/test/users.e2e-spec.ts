import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseAdminService } from "../src/auth/firebase-admin.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { BookingExpiryProcessor } from "../src/bookings/processors/booking-expiry.processor";

describe("Users (e2e)", () => {
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { firebaseUid: { startsWith: "e2e-users-uid" } },
    });
    await app.close();
  });

  it("returns 401 with no Authorization header", async () => {
    await request(app.getHttpServer()).get("/api/users/me").expect(401);
  });

  it("returns 401 for a token Firebase rejects", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad"));
    await request(app.getHttpServer())
      .get("/api/users/me")
      .set("Authorization", "Bearer bad-token")
      .expect(401);
  });

  it("returns 401 for a valid token with no matching platform user", async () => {
    verifyIdToken.mockResolvedValue({ uid: "e2e-users-uid-never-registered" });
    await request(app.getHttpServer())
      .get("/api/users/me")
      .set("Authorization", "Bearer good-token")
      .expect(401);
  });

  it("returns the current user for a valid token", async () => {
    await prisma.user.create({
      data: { firebaseUid: "e2e-users-uid-1", phone: "+6281234599911" },
    });
    verifyIdToken.mockResolvedValue({ uid: "e2e-users-uid-1" });

    const res = await request(app.getHttpServer())
      .get("/api/users/me")
      .set("Authorization", "Bearer good-token")
      .expect(200);

    expect(res.body.phone).toBe("+6281234599911");
    expect(res.body.role).toBeNull();
    expect(res.body.hasProfile).toBe(false);
    expect(res.body.whatsappOptOut).toBe(false);
  });

  describe("PATCH /users/me", () => {
    it("updates the user's name", async () => {
      await prisma.user.create({
        data: { firebaseUid: "e2e-users-uid-name-1", phone: "+6281234599920" },
      });
      verifyIdToken.mockResolvedValue({ uid: "e2e-users-uid-name-1" });

      const res = await request(app.getHttpServer())
        .patch("/api/users/me")
        .set("Authorization", "Bearer good-token")
        .send({ name: "Budi Santoso" })
        .expect(200);

      expect(res.body.name).toBe("Budi Santoso");
    });

    it("rejects an empty name", async () => {
      verifyIdToken.mockResolvedValue({ uid: "e2e-users-uid-name-1" });
      await request(app.getHttpServer())
        .patch("/api/users/me")
        .set("Authorization", "Bearer good-token")
        .send({ name: "" })
        .expect(400);
    });
  });

  describe("PATCH /users/me/role", () => {
    it("sets the role for a user with no role yet", async () => {
      await prisma.user.create({
        data: { firebaseUid: "e2e-users-uid-role-1", phone: "+6281234599912" },
      });
      verifyIdToken.mockResolvedValue({ uid: "e2e-users-uid-role-1" });

      const res = await request(app.getHttpServer())
        .patch("/api/users/me/role")
        .set("Authorization", "Bearer good-token")
        .send({ role: "TUTOR" })
        .expect(200);

      expect(res.body.role).toBe("TUTOR");
    });

    it("rejects setting the role a second time", async () => {
      verifyIdToken.mockResolvedValue({ uid: "e2e-users-uid-role-1" });
      await request(app.getHttpServer())
        .patch("/api/users/me/role")
        .set("Authorization", "Bearer good-token")
        .send({ role: "STUDENT" })
        .expect(409);
    });

    it("rejects an invalid role value", async () => {
      await prisma.user.create({
        data: { firebaseUid: "e2e-users-uid-role-2", phone: "+6281234599913" },
      });
      verifyIdToken.mockResolvedValue({ uid: "e2e-users-uid-role-2" });

      await request(app.getHttpServer())
        .patch("/api/users/me/role")
        .set("Authorization", "Bearer good-token")
        .send({ role: "ADMIN" })
        .expect(400);
    });
  });

  describe("PATCH /users/me/notification-preferences", () => {
    it("opts out of WhatsApp and reflects it on subsequent GET /users/me", async () => {
      await prisma.user.create({
        data: { firebaseUid: "e2e-users-uid-notif-1", phone: "+6281234599914" },
      });
      verifyIdToken.mockResolvedValue({ uid: "e2e-users-uid-notif-1" });

      const res = await request(app.getHttpServer())
        .patch("/api/users/me/notification-preferences")
        .set("Authorization", "Bearer good-token")
        .send({ whatsappOptOut: true })
        .expect(200);
      expect(res.body.whatsappOptOut).toBe(true);

      const getRes = await request(app.getHttpServer())
        .get("/api/users/me")
        .set("Authorization", "Bearer good-token")
        .expect(200);
      expect(getRes.body.whatsappOptOut).toBe(true);
    });

    it("rejects a non-boolean whatsappOptOut", async () => {
      verifyIdToken.mockResolvedValue({ uid: "e2e-users-uid-notif-1" });
      await request(app.getHttpServer())
        .patch("/api/users/me/notification-preferences")
        .set("Authorization", "Bearer good-token")
        .send({ whatsappOptOut: "yes" })
        .expect(400);
    });
  });
});
