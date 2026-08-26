# Task 1.7 — Session Management & Auth Guards

**Sprint:** 1 — Authentication & Onboarding
**Estimate:** 2 days

## Goal

Every API route from Sprint 2 onward needs consistent authentication and role-based authorization — build the guard infrastructure now rather than bolting it onto each feature module individually.

## Scope

- NestJS `AuthGuard` that verifies the Firebase ID token (or platform session, per the decision in [Task 1.1](task-1-phone-otp-auth.md)) on protected routes and attaches the resolved `User` to the request context.
- `RolesGuard` + `@Roles(...)` decorator for endpoint-level role restriction (`STUDENT`, `TUTOR`, `ADMIN`).
- Consistent 401 (unauthenticated) vs 403 (wrong role) error responses, with a shared error shape used across the API.
- Mobile/web HTTP client: attaches the current auth token to every request automatically, handles 401 by redirecting to login.
- Token refresh handling (Firebase ID tokens expire hourly) — client-side silent refresh so users aren't logged out mid-session.
- Logout flow: clears local session, revokes token where applicable.

## Acceptance Criteria

- [ ] Calling any protected endpoint without a token returns 401 with a consistent error shape.
- [ ] Calling a role-restricted endpoint with the wrong role returns 403.
- [ ] A route decorated `@Roles('ADMIN')` is unreachable by a `STUDENT` or `TUTOR` token, verified by tests.
- [ ] Client apps transparently refresh expiring tokens without forcing re-login during normal use.
- [ ] Logout clears session state on both mobile and web and redirects to the login screen.

## Technical Notes

- This is foundational plumbing for every feature module from Sprint 2 onward — treat it as blocking for the rest of the roadmap, not just Sprint 1's own tasks.

## Dependencies

- [Task 1.1 — Phone OTP Authentication (Backend)](task-1-phone-otp-auth.md)
