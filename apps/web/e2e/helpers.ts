import { APIRequestContext } from "@playwright/test";
import { Client } from "pg";
import { API_URL, E2E_AUTH_BYPASS_SECRET } from "../playwright.config";

/** Every user this suite creates gets a firebaseUid under this prefix, so cleanup can find them all with one LIKE query without touching real/seed data. */
export const E2E_UID_PREFIX = "e2e-pw-";

/** Budi Santoso, VERIFIED (prisma/seed.ts) - reused for tutor-side actions instead of onboarding a whole new tutor, out of scope for Task 8.1. */
export const SEED_TUTOR_UID = "seed-tutor-1";

/**
 * Off-peak half-hour reused by every test in this suite that needs a
 * bookable time - there's no more declared availability to seed against
 * (prisma/seed.ts's tutors ship with zero bookings), any future half-hour
 * not already booked is fair game. Each test picks its own day offset
 * (see dateDaysFromNow) so they never contend for the same instant.
 */
export const E2E_START_TIME = "22:00";

/** A calendar date `days` days from today, formatted "YYYY-MM-DD" - matches how the backend parses CreateBookingDto.scheduledDate. */
export function dateDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function uniqueUid(label: string): string {
  return `${E2E_UID_PREFIX}${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Builds a token FirebaseAdminService's E2E bypass accepts in place of a
 * real Firebase ID token (see services/api/src/auth/firebase-admin.service.ts).
 * `uid` may be a freshly generated one (see uniqueUid) or a known seeded
 * user's firebaseUid (e.g. "seed-tutor-1") - the bypass doesn't care which,
 * exactly like the Jest e2e suite's `verifyIdToken.mockResolvedValue({uid})`.
 */
export function bypassToken(uid: string, extra: { email?: string; phone_number?: string } = {}): string {
  const payload = { secret: E2E_AUTH_BYPASS_SECRET, uid, ...extra };
  return `E2E.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

export function authHeader(uid: string, extra?: { email?: string; phone_number?: string }) {
  return { Authorization: `Bearer ${bypassToken(uid, extra)}` };
}

/** Exchanges the bypass token for a platform session the same way LoginForm's real Firebase flow does, creating the User row on first call. */
export async function registerSession(
  request: APIRequestContext,
  uid: string,
  extra?: { email?: string; phone_number?: string },
) {
  const res = await request.post(`${API_URL}/auth/session`, {
    data: { idToken: bypassToken(uid, extra) },
  });
  if (!res.ok()) {
    throw new Error(`/auth/session failed for ${uid}: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Deletes every row this suite created (by e2e-pw- firebaseUid prefix),
 * respecting FK direction the same way the Jest e2e specs' afterAll
 * blocks do. Connects directly to the local docker-compose Postgres
 * (docker-compose.yml at repo root) - fine for a dev/CI-local E2E run,
 * never pointed at anything else.
 */
export async function cleanupE2EData(): Promise<void> {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://smartbimbel:smartbimbel@localhost:5433/smartbimbel_dev?schema=public",
  });
  await client.connect();
  try {
    const uidPattern = `${E2E_UID_PREFIX}%`;
    // Bookings this suite created reach the DB either as the student (any
    // new e2e-pw- account) or, for future edge cases, as the tutor (if a
    // test ever creates a full tutor profile rather than reusing a seeded
    // one) - both are covered so cleanup doesn't silently miss rows.
    const bookingIdsRes = await client.query<{ id: string }>(
      `SELECT b.id FROM "Booking" b
       LEFT JOIN "StudentProfile" sp ON sp.id = b."studentId"
       LEFT JOIN "TutorProfile" tp ON tp.id = b."tutorId"
       LEFT JOIN "User" su ON su.id = sp."userId"
       LEFT JOIN "User" tu ON tu.id = tp."userId"
       WHERE su."firebaseUid" LIKE $1 OR tu."firebaseUid" LIKE $1`,
      [uidPattern],
    );
    const bookingIds = bookingIdsRes.rows.map((r) => r.id);

    await client.query(`DELETE FROM "AuditLog" WHERE "adminUserId" IN (SELECT id FROM "User" WHERE "firebaseUid" LIKE $1)`, [uidPattern]);
    await client.query(`DELETE FROM "Notification" WHERE "userId" IN (SELECT id FROM "User" WHERE "firebaseUid" LIKE $1)`, [uidPattern]);
    if (bookingIds.length > 0) {
      await client.query(`DELETE FROM "Dispute" WHERE "bookingId" = ANY($1)`, [bookingIds]);
      await client.query(`DELETE FROM "Transaction" WHERE "bookingId" = ANY($1)`, [bookingIds]);
      await client.query(`DELETE FROM "BookingStatusHistory" WHERE "bookingId" = ANY($1)`, [bookingIds]);
      await client.query(`DELETE FROM "Conversation" WHERE "bookingId" = ANY($1)`, [bookingIds]);
      await client.query(`DELETE FROM "Booking" WHERE id = ANY($1)`, [bookingIds]);
    }
    await client.query(`DELETE FROM "StudentProfile" WHERE "userId" IN (SELECT id FROM "User" WHERE "firebaseUid" LIKE $1)`, [uidPattern]);
    await client.query(`DELETE FROM "TutorProfile" WHERE "userId" IN (SELECT id FROM "User" WHERE "firebaseUid" LIKE $1)`, [uidPattern]);
    await client.query(`DELETE FROM "User" WHERE "firebaseUid" LIKE $1`, [uidPattern]);
  } finally {
    await client.end();
  }
}
