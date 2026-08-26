# Sprint 1 — Authentication & Onboarding

**Duration:** 2 weeks
**PRD reference:** §6.1.A

## Goal

A student/parent or tutor can register, verify their identity, choose a role, and complete a role-appropriate profile — ending with tutors in a "pending verification" state and students ready to browse.

## Scope

1. [Phone OTP Authentication (Backend)](task-1-phone-otp-auth.md)
2. [Email & Google OAuth Login](task-2-email-google-oauth.md)
3. [Role Selection & Registration Flow](task-3-role-selection-registration.md)
4. [Student/Parent Profile Setup](task-4-student-profile-setup.md)
5. [Tutor Multi-Step Profile Completion](task-5-tutor-profile-completion.md)
6. [Minimal Tutor Verification Workflow](task-6-tutor-verification-minimal.md)
7. [Session Management & Auth Guards](task-7-session-auth-guards.md)

## Dependencies

- Sprint 0 complete: Firebase project, database schema, design system, monorepo/CI.

## Exit Criteria

- A new user can sign up via phone OTP, email, or Google on mobile and web.
- Role selection persists and drives which onboarding flow the user sees.
- Student profile (grade level, subjects of interest, location/mode preference) is saved and retrievable.
- Tutor profile (photo, bio, subjects, grade levels, rates, mode, location, education, availability) is saved, and the tutor sits in a `PENDING_VERIFICATION` state.
- An internal operator (even via direct DB/Prisma Studio access — full admin UI isn't built until Sprint 7) can flip a tutor to `VERIFIED` and have that reflected in the app.
- API routes are protected by auth guards; unauthenticated or wrong-role requests are rejected with proper error codes.
