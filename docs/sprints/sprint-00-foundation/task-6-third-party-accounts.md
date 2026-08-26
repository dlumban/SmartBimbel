# Task 0.6 — Third-Party Service Accounts Setup

**Sprint:** 0 — Foundation & Tech Setup
**Estimate:** 2 days (mostly waiting on approvals — start this task on day 1 of the sprint)

## Goal

Get every external dependency the MVP needs provisioned early, since several (WhatsApp BSP, payment gateway) have multi-day approval processes that can otherwise block later sprints.

## Scope

- **Firebase project**: Auth (phone OTP + Google), Cloud Messaging, Storage (or confirm Cloudinary as the alternative — see technical notes).
- **Payment gateway**: Midtrans sandbox account (primary, per architectural decision in [sprint README](README.md)); Xendit sandbox as documented fallback. Start business verification for production credentials now — this is the longest lead-time item.
- **WhatsApp Business API**: evaluate and select a BSP (e.g. Woztell, Qontak, or Twilio's WhatsApp API) for booking/reminder notifications per PRD §7. Start the business verification process immediately.
- **Sentry**: project created for `api`, `web`, `admin`, and `mobile`.
- **Google Maps Platform**: API key with Places + Geocoding enabled, billing configured with quota alerts.
- **Analytics**: Firebase Analytics (bundled with Firebase project) + Mixpanel or Amplitude account.
- **Cloudinary** (or confirm Firebase Storage suffices for MVP photo/document volume): account created if selected.
- Central secrets doc: which service, which environment, where the credential lives (GitHub Actions secrets, Railway/Vercel env vars) — no credentials in the doc itself.

## Acceptance Criteria

- [ ] Firebase project exists with Auth providers (phone, Google) enabled and tested with a dummy sign-in.
- [ ] Midtrans sandbox credentials work against a test transaction; production business verification is submitted.
- [ ] WhatsApp BSP is selected and business verification is submitted (even if approval lands mid-way through later sprints).
- [ ] Sentry receives a test error from each app.
- [ ] Google Maps API key is restricted (HTTP referrer / Android package / iOS bundle ID) and returns results for a test geocode query.
- [ ] `docs/infrastructure.md` lists every service, its purpose, and where its credentials are stored.

## Technical Notes

- Because WhatsApp BSP and Midtrans production approval can take 1–2 weeks, kick this task off in parallel with Task 0.1, not after it — it's on the critical path for Sprint 5 (Payments) and Sprint 3 (WhatsApp reminders), not for Sprint 0 itself.
- Sandbox/test credentials are sufficient to unblock Sprints 1–4; only Sprint 5 needs production payment credentials to be live.

## Dependencies

None — start immediately, run in parallel with all other Sprint 0 tasks.
