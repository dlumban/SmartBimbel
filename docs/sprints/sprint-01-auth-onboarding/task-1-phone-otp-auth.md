# Task 1.1 — Phone OTP Authentication (Backend)

**Sprint:** 1 — Authentication & Onboarding
**Estimate:** 3 days

## Goal

Phone number + OTP is the primary login method per PRD §6.1.A. Wire Firebase Auth's phone provider end-to-end through the API so a phone number reliably becomes a platform `User`.

## Scope

- Firebase Admin SDK integrated into `services/api` for verifying ID tokens issued after client-side phone OTP confirmation.
- `POST /auth/session`: accepts a Firebase ID token, verifies it server-side, upserts a `User` row (creates on first login, keyed by `firebaseUid`), returns a platform session (JWT or continues using Firebase token — decide and document).
- Rate limiting on OTP-triggering endpoints to prevent SMS-bombing abuse (Firebase has its own limits, but add app-level throttling on the initiating endpoint too).
- Error handling for expired/invalid tokens, mismatched phone formats (E.164 normalization for Indonesian numbers).

## Acceptance Criteria

- [ ] A valid Firebase phone-auth ID token creates a new `User` on first call and returns the same `User` on subsequent calls.
- [ ] Invalid/expired tokens return 401 with a clear error code, not a 500.
- [ ] Phone numbers are normalized and stored in E.164 format (`+62...`).
- [ ] Rate limiting is verified with a test that trips the limit and gets a 429.
- [ ] Unit tests cover: new user creation, existing user login, invalid token, expired token.

## Technical Notes

- Client (mobile/web) triggers Firebase's phone auth flow directly against Firebase — the API never sees the raw OTP, only the resulting ID token. This keeps SMS delivery entirely on Firebase's infrastructure.
- Decide session strategy now: either the API trusts Firebase ID tokens on every request (simplest, but couples every request to Firebase token verification latency) or issues its own short-lived JWT after the initial exchange (adds complexity, decouples from Firebase). Recommendation: trust Firebase ID tokens directly for MVP, revisit only if latency becomes an issue.

## Dependencies

- Sprint 0: [Third-Party Service Accounts](../sprint-00-foundation/task-6-third-party-accounts.md) (Firebase project), [Database Schema](../sprint-00-foundation/task-4-database-schema.md)
