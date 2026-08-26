# Task 1.3 — Role Selection & Registration Flow

**Sprint:** 1 — Authentication & Onboarding
**Estimate:** 3 days

## Goal

After first authentication, route the user into a role-specific onboarding path (Student/Parent vs Tutor) and make that choice persistent and (mostly) immutable.

## Scope

- Post-login screen (mobile + web): "I'm a Student/Parent" vs "I'm a Tutor" — only shown when `User.role` is unset.
- `PATCH /users/me/role` endpoint: sets role once; reject changing an already-set role via this endpoint (role changes, if ever needed, go through admin support, not self-service).
- Routing logic: authenticated user with no role → role selection screen; role set but profile incomplete → resume onboarding at the right step; profile complete → main app.
- Onboarding progress persistence so a user who closes the app mid-onboarding resumes where they left off rather than restarting.

## Acceptance Criteria

- [ ] New user is forced through role selection before reaching any other screen.
- [ ] Role, once set, cannot be changed via the self-service endpoint (verified by a test expecting a 4xx on a second call).
- [ ] Closing and reopening the app mid-profile-setup resumes at the correct onboarding step, not the beginning.
- [ ] Both mobile and web implement identical routing logic (shared logic in `packages/shared` where feasible).

## Technical Notes

- Store an `onboardingStep` or derive progress from which profile fields are non-null — prefer deriving from data over a separate tracking field to avoid the two getting out of sync.

## Dependencies

- [Task 1.1 — Phone OTP Authentication (Backend)](task-1-phone-otp-auth.md)
