import { test, expect, APIRequestContext } from "@playwright/test";
import { API_URL } from "../playwright.config";
import { authHeader, dateDaysFromNow, E2E_START_TIME, registerSession, uniqueUid } from "./helpers";

/**
 * Edge-case matrix item (Task 8.1): concurrent booking race, from Sprint
 * 3 Task 3.2's own note. bookings.service.ts's create() takes a Postgres
 * advisory lock scoped to the tutor inside the transaction specifically so
 * two simultaneous requests for the same half-hour can't both succeed -
 * this drives that scenario against the real live server with two real
 * concurrent HTTP requests, not two calls to the same in-process method.
 */
test.describe("Concurrent booking race", () => {
  let request: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext();
  });

  test.afterAll(async () => {
    await request.dispose();
  });

  test("only one of two simultaneous requests for the same tutor+time succeeds", async () => {
    const uidA = uniqueUid("student-race-a");
    const uidB = uniqueUid("student-race-b");
    await Promise.all([registerSession(request, uidA), registerSession(request, uidB)]);
    await Promise.all(
      [uidA, uidB].map((uid) =>
        request.patch(`${API_URL}/users/me/role`, {
          headers: authHeader(uid),
          data: { role: "STUDENT" },
        }),
      ),
    );

    const [subjects, gradeLevels] = await Promise.all([
      request.get(`${API_URL}/subjects`).then((r) => r.json()),
      request.get(`${API_URL}/grade-levels`).then((r) => r.json()),
    ]);
    const matematika = subjects.find((s: { name: string }) => s.name === "Matematika");
    await Promise.all(
      [uidA, uidB].map((uid) =>
        request.post(`${API_URL}/students/profile`, {
          headers: authHeader(uid),
          data: { gradeLevelId: gradeLevels[0].id, subjectIds: [matematika.id] },
        }),
      ),
    );

    const budi = (await request.get(`${API_URL}/tutors?limit=50`).then((r) => r.json())).data.find(
      (t: { name: string }) => t.name === "Budi Santoso",
    );

    // A day offset not used by happy-path-api.spec.ts's own bookings against this same tutor, so the two spec files never contend for the same instant.
    const bookingData = {
      tutorId: budi.id,
      startTime: E2E_START_TIME,
      subjectId: matematika.id,
      scheduledDate: dateDaysFromNow(300),
      durationMinutes: 60,
      mode: "ONLINE" as const,
    };

    const [resA, resB] = await Promise.all([
      request.post(`${API_URL}/bookings`, { headers: authHeader(uidA), data: bookingData }),
      request.post(`${API_URL}/bookings`, { headers: authHeader(uidB), data: bookingData }),
    ]);

    const statuses = [resA.status(), resB.status()].sort();
    expect(statuses).toEqual([201, 400]);

    const loserRes = resA.status() === 400 ? resA : resB;
    const loserBody = await loserRes.json();
    expect(loserBody.message).toContain("no longer available");
  });
});
