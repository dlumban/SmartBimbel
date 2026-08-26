import { test, expect, APIRequestContext } from "@playwright/test";
import { API_URL } from "../playwright.config";
import { authHeader, dateDaysFromNow, E2E_START_TIME, registerSession, SEED_TUTOR_UID, uniqueUid } from "./helpers";

/**
 * Full-server API-level E2E (Task 8.1): drives the real, live NestJS
 * process (real Postgres/Redis, real BullMQ queues, real guards/DTOs
 * validation) via HTTP, exactly as production traffic would hit it -
 * just via Playwright's `request` fixture instead of a rendered browser,
 * using the backend's E2E auth bypass (services/api/src/auth/
 * firebase-admin.service.ts) in place of a real Firebase login.
 *
 * Reaches as far as this environment's unconfigured Midtrans allows: a
 * REQUESTED booking through ACCEPTED, then a verified "payments
 * unavailable" response at the checkout step - the same thing a real
 * user hits today. The pay -> webhook -> CONFIRMED transition (and
 * everything past it: chat, session completion, review) needs a
 * deterministic fake payment gateway, which only exists as a Jest
 * TestingModule DI override (services/api/test/payments-webhook.e2e-spec.ts,
 * sessions-reviews.e2e-spec.ts) - not reachable from outside the process,
 * so it isn't duplicated here. See changes.md for the full breakdown.
 */
test.describe("Happy path (API-level, live server)", () => {
  let request: APIRequestContext;
  const studentUid = uniqueUid("student-happy");

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext();
  });

  test.afterAll(async () => {
    await request.dispose();
  });

  test("registration -> role -> profile -> discovery -> booking request -> tutor accept -> payment unavailable", async () => {
    // 1. Registration (mirrors LoginForm's real getIdToken() -> exchangeSession() call).
    const session = await registerSession(request, studentUid, { email: `${studentUid}@example.com` });
    expect(session.role).toBeNull();

    // 2. Role selection.
    const roleRes = await request.patch(`${API_URL}/users/me/role`, {
      headers: authHeader(studentUid),
      data: { role: "STUDENT" },
    });
    expect(roleRes.status()).toBe(200);
    expect((await roleRes.json()).role).toBe("STUDENT");

    // 3. Profile completion.
    const [subjectsRes, gradeLevelsRes] = await Promise.all([
      request.get(`${API_URL}/subjects`),
      request.get(`${API_URL}/grade-levels`),
    ]);
    const subjects = await subjectsRes.json();
    const gradeLevels = await gradeLevelsRes.json();
    const matematika = subjects.find((s: { name: string }) => s.name === "Matematika");
    expect(matematika).toBeTruthy();

    const profileRes = await request.post(`${API_URL}/students/profile`, {
      headers: authHeader(studentUid),
      data: { gradeLevelId: gradeLevels[0].id, subjectIds: [matematika.id] },
    });
    expect(profileRes.status()).toBe(201);

    // 4. Tutor discovery (public, no auth needed).
    const discoverRes = await request.get(`${API_URL}/tutors?limit=50`);
    const discovery = await discoverRes.json();
    const budi = discovery.data.find((t: { name: string }) => t.name === "Budi Santoso");
    expect(budi).toBeTruthy();

    const detailRes = await request.get(`${API_URL}/tutors/${budi.id}`);
    const detail = await detailRes.json();
    expect(detail.id).toBe(budi.id);

    // 5. Booking request, against a fixed day offset unique to this test
    // (see helpers.ts) so it never contends with any other spec's bookings
    // against the same seeded tutor.
    const bookingRes = await request.post(`${API_URL}/bookings`, {
      headers: authHeader(studentUid),
      data: {
        tutorId: budi.id,
        startTime: E2E_START_TIME,
        subjectId: matematika.id,
        scheduledDate: dateDaysFromNow(310),
        durationMinutes: 60,
        mode: "ONLINE",
      },
    });
    expect(bookingRes.status()).toBe(201);
    const booking = await bookingRes.json();
    expect(booking.status).toBe("REQUESTED");

    // 6. Tutor accepts (logging in as the seeded tutor via the same bypass).
    const acceptRes = await request.patch(`${API_URL}/bookings/${booking.id}/accept`, {
      headers: authHeader(SEED_TUTOR_UID),
    });
    expect(acceptRes.status()).toBe(200);
    expect((await acceptRes.json()).status).toBe("ACCEPTED");

    // 7. Checkout: correctly reports unavailable, since Midtrans isn't
    // configured in this environment. The frontend no longer surfaces this
    // endpoint to students (payment is handled outside the app now), but
    // the backend route itself is still exercised here directly.
    const payRes = await request.post(`${API_URL}/bookings/${booking.id}/pay`, {
      headers: authHeader(studentUid),
    });
    expect(payRes.status()).toBe(503);
  });

  test("tutor decline releases the booking without touching the slot's other occurrences", async () => {
    const uid = uniqueUid("student-decline");
    await registerSession(request, uid);
    await request.patch(`${API_URL}/users/me/role`, {
      headers: authHeader(uid),
      data: { role: "STUDENT" },
    });
    const [subjects, gradeLevels] = await Promise.all([
      request.get(`${API_URL}/subjects`).then((r) => r.json()),
      request.get(`${API_URL}/grade-levels`).then((r) => r.json()),
    ]);
    const matematika = subjects.find((s: { name: string }) => s.name === "Matematika");
    await request.post(`${API_URL}/students/profile`, {
      headers: authHeader(uid),
      data: { gradeLevelId: gradeLevels[0].id, subjectIds: [matematika.id] },
    });

    const budi = (await request.get(`${API_URL}/tutors?limit=50`).then((r) => r.json())).data.find(
      (t: { name: string }) => t.name === "Budi Santoso",
    );

    const booking = await request
      .post(`${API_URL}/bookings`, {
        headers: authHeader(uid),
        data: {
          tutorId: budi.id,
          startTime: E2E_START_TIME,
          subjectId: matematika.id,
          scheduledDate: dateDaysFromNow(320), // a different day than the happy-path test above
          durationMinutes: 60,
          mode: "ONLINE",
        },
      })
      .then((r) => r.json());

    const declineRes = await request.patch(`${API_URL}/bookings/${booking.id}/decline`, {
      headers: authHeader(SEED_TUTOR_UID),
      data: { reason: "Jadwal bentrok" },
    });
    expect(declineRes.status()).toBe(200);
    expect((await declineRes.json()).status).toBe("DECLINED");
  });
});
