# Task 8.3 — Security Review & Hardening

**Sprint:** 8 — Hardening & Soft Launch
**Estimate:** 3 days

## Goal

PRD §7: "Encrypted data, secure authentication, PCI-compliant payment handling, compliance with Indonesian personal data protection principles." This task is the dedicated pass to verify those requirements are actually met, not assumed.

## Scope

- Full codebase security review covering: auth guard coverage (every endpoint from Sprints 1–7 correctly protected per [Task 1.7](../sprint-01-auth-onboarding/task-7-session-auth-guards.md)'s guards), injection risks, IDOR checks (can user A access user B's booking/profile/transaction by guessing an ID?), file upload handling (KTP/diploma documents from [Task 1.5](../sprint-01-auth-onboarding/task-5-tutor-profile-completion.md)).
- Payment security: confirm no card/payment credential data ever touches SmartBimbel's own servers (Midtrans Snap's hosted checkout, per [Task 5.1](../sprint-05-payments/task-1-payment-gateway-integration.md), should already ensure this — verify it, don't assume it) — confirms PCI scope stays minimal.
- Data protection review against Indonesia's UU PDP (Personal Data Protection Law) principles: what personal data is collected (KTP images, phone numbers, location), how it's stored, who can access it, retention policy.
- Secrets audit: confirm no credentials are committed to the repo or exposed client-side (recheck [Task 0.1](../sprint-00-foundation/task-1-repo-monorepo-setup.md)'s and [Task 0.6](../sprint-00-foundation/task-6-third-party-accounts.md)'s conventions were actually followed throughout).
- Dependency vulnerability scan (`npm audit`/`pnpm audit`, Flutter's `pub outdated`/security advisories).
- Rate limiting review across all public-facing endpoints, not just the auth endpoint covered in [Task 1.1](../sprint-01-auth-onboarding/task-1-phone-otp-auth.md).

## Acceptance Criteria

- [ ] No IDOR vulnerabilities found in a sampled review of booking, profile, transaction, and document endpoints (or all found issues are fixed).
- [ ] Confirmed no raw payment card data ever transits or is stored on SmartBimbel infrastructure.
- [ ] Personal data handling is documented against UU PDP principles with any gaps flagged and, where feasible, closed before launch.
- [ ] No secrets found in git history or client-side bundles.
- [ ] No critical/high dependency vulnerabilities remain unpatched.

## Technical Notes

- This is a natural point to run a structured security review process against the accumulated codebase rather than only reviewing diffs sprint-by-sprint — treat it as a dedicated audit pass covering everything built since Sprint 0.

## Dependencies

- All feature sprints (0–7) functionally complete.
