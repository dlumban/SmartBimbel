import http from "k6/http";
import encoding from "k6/encoding";
import { check } from "k6";

// Task 8.2 load test: booking creation, the highest-value write endpoint
// (real Postgres transaction with an advisory lock + overlap check,
// BullMQ enqueue, best-effort Stream channel creation). Uses the same
// E2E auth bypass Playwright's suite uses
// (services/api/src/auth/firebase-admin.service.ts) - run the API with
// E2E_AUTH_BYPASS_SECRET set to the same value as E2E_SECRET below (or
// override via -e). setup() pre-registers one throwaway student per
// planned VU so the timed portion measures booking creation itself, not
// registration. Each iteration targets its own scheduledDate/startTime
// (VU x iteration far enough apart to never collide), so throughput
// reflects real concurrent write load, not the (correct, expected) 400s
// two students racing for the exact same time would get - that specific
// contention scenario is covered functionally, not for throughput, by
// apps/web/e2e/concurrent-booking.spec.ts.
const API_URL = __ENV.API_URL || "http://localhost:4000/api";
const E2E_SECRET = __ENV.E2E_AUTH_BYPASS_SECRET || "loadtest-e2e-secret-never-used-in-prod";
const MAX_VUS = 5;
const UID_PREFIX = "e2e-pw-k6-";

export const options = {
  scenarios: {
    bookingCreate: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 10 },
        { duration: "20s", target: MAX_VUS },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

function bypassToken(uid) {
  const payload = JSON.stringify({ secret: E2E_SECRET, uid });
  return `E2E.${encoding.b64encode(payload, "rawurl")}`;
}

function authHeaders(uid) {
  return { Authorization: `Bearer ${bypassToken(uid)}`, "Content-Type": "application/json" };
}

function dateDaysFromNow(days) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const SEED_TUTOR_UID = "seed-tutor-1"; // Budi Santoso, VERIFIED (prisma/seed.ts)
// Off-peak half-hour, unlikely to collide with any real usage of the
// shared dev DB - no more declared availability to seed, any half-hour
// not already booked is bookable.
const LOAD_TEST_START_TIME = "22:00";

export function setup() {
  const subjects = JSON.parse(http.get(`${API_URL}/subjects`).body);
  const gradeLevels = JSON.parse(http.get(`${API_URL}/grade-levels`).body);
  const matematika = subjects.find((s) => s.name === "Matematika");

  const tutors = JSON.parse(http.get(`${API_URL}/tutors?limit=50`).body).data;
  const budi = tutors.find((t) => t.name === "Budi Santoso");

  const uids = [];
  for (let i = 0; i < MAX_VUS; i += 1) {
    const uid = `${UID_PREFIX}${Date.now()}-${i}`;
    http.post(`${API_URL}/auth/session`, JSON.stringify({ idToken: bypassToken(uid) }), {
      headers: { "Content-Type": "application/json" },
    });
    http.patch(`${API_URL}/users/me/role`, JSON.stringify({ role: "STUDENT" }), {
      headers: authHeaders(uid),
    });
    http.post(
      `${API_URL}/students/profile`,
      JSON.stringify({ gradeLevelId: gradeLevels[0].id, subjectIds: [matematika.id] }),
      { headers: authHeaders(uid) },
    );
    uids.push(uid);
  }

  return { uids, tutorId: budi.id, subjectId: matematika.id };
}

export default function (data) {
  const uid = data.uids[__VU % data.uids.length];
  // Large, VU+iteration-unique day offset so no two requests in this run
  // (or a prior run using the same VU count) ever target the same date.
  const daysAhead = 200 + __VU * 1000 + __ITER;
  const scheduledDate = dateDaysFromNow(daysAhead);

  const res = http.post(
    `${API_URL}/bookings`,
    JSON.stringify({
      tutorId: data.tutorId,
      startTime: LOAD_TEST_START_TIME,
      subjectId: data.subjectId,
      scheduledDate,
      durationMinutes: 60,
      mode: "ONLINE",
    }),
    { headers: authHeaders(uid) },
  );

  check(res, { "status is 201": (r) => r.status === 201 });
}
