# Task 1.2 — Email & Google OAuth Login

**Sprint:** 1 — Authentication & Onboarding
**Estimate:** 2 days

## Goal

Support the two secondary login methods named in PRD §6.1.A, reusing the same session-exchange endpoint built for phone OTP.

## Scope

- Enable email/password and Google providers in Firebase Auth.
- Mobile: Google Sign-In SDK integration; email/password form.
- Web: Firebase Auth JS SDK for Google OAuth popup/redirect flow and email/password form.
- Reuse `POST /auth/session` from [Task 1.1](task-1-phone-otp-auth.md) — it already accepts any valid Firebase ID token regardless of provider.
- Account linking consideration: if a user later tries Google sign-in with an email that already exists via email/password, define behavior (Firebase's native account linking, or block with a clear error).
- Password reset flow (Firebase's built-in email reset link).

## Acceptance Criteria

- [ ] User can register/log in via Google on both mobile and web.
- [ ] User can register/log in via email + password on both mobile and web.
- [ ] Password reset email is sent and successfully resets access.
- [ ] Attempting to sign in with a Google account whose email matches an existing email/password account produces a defined, non-crashing behavior.
- [ ] Same `User` row is reused across providers if account linking is enabled (no duplicate users for one person).

## Technical Notes

- No new backend endpoint needed beyond what Task 1.1 built — this task is primarily client-side integration plus Firebase console configuration.

## Dependencies

- [Task 1.1 — Phone OTP Authentication (Backend)](task-1-phone-otp-auth.md)
