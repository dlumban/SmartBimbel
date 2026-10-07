# Third-Party Account Setup Checklist

Companion doc to [Task 0.6](sprints/sprint-00-foundation/task-6-third-party-accounts.md). None of these accounts have been created — each requires business ownership, billing details, or identity verification that has to come from the project owner, not something that can be done on your behalf. This is the concrete checklist to work through; every corresponding env var is already wired into the codebase and waiting.

| # | Service | Purpose | Env vars already scaffolded | Blocking? |
|---|---|---|---|---|
| 1 | **Firebase** | Phone OTP + Google auth, Cloud Messaging (push), Storage | `services/api/.env.example`: `FIREBASE_*` · `apps/web`, `apps/admin` `.env.example`: `NEXT_PUBLIC_FIREBASE_*` | Blocks [Sprint 1](sprints/sprint-01-auth-onboarding/README.md) entirely |
| 2 | **Midtrans** | Payments (QRIS, e-wallets, VA, bank transfer) | `services/api/.env.example`: `MIDTRANS_*` | Blocks [Sprint 5](sprints/sprint-05-payments/README.md); longest lead time (production business verification) |
| 3 | **Stream Chat** | Real-time messaging | `services/api/.env.example`: `STREAM_*` · `apps/web/.env.example`: `NEXT_PUBLIC_STREAM_API_KEY` | Blocks [Sprint 4](sprints/sprint-04-messaging/README.md) |
| 3b | **Daily.co** | In-app video rooms (Phase 2); whiteboard is tldraw (no account) | `services/api/.env.example`: `DAILY_API_KEY` · optional `apps/web/.env.example`: `NEXT_PUBLIC_DAILY_DOMAIN` | Non-blocking — Zoom/Meet paste links remain the fallback |
| 4 | **WhatsApp Business API** (via a BSP - e.g. Woztell, Qontak, Twilio) | Booking/reminder notifications | `services/api/.env.example`: `WHATSAPP_BSP_*` | Blocks WhatsApp channel in [Sprint 3, Task 3.6](sprints/sprint-03-booking/task-6-notification-integration.md) (push/email can ship without it) |
| 5 | **Sentry** | Error monitoring | `services/api/.env.example`: `SENTRY_DSN` · `apps/web`, `apps/admin` `.env.example`: `NEXT_PUBLIC_SENTRY_DSN` | Non-blocking until [Sprint 8](sprints/sprint-08-hardening-launch/task-5-analytics-error-monitoring.md) |
| 6 | **Google Maps Platform** | Geocoding, Places Autocomplete, "nearest" sort | `services/api/.env.example`: `GOOGLE_MAPS_API_KEY` · `apps/web/.env.example`: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Blocks [Sprint 2, Task 2.5](sprints/sprint-02-discovery/task-5-location-maps-integration.md) |
| 7 | **Cloudinary** (or confirm Firebase Storage covers MVP volume) | Tutor photos/documents | `services/api/.env.example`: `STORAGE_PROVIDER`, `CLOUDINARY_URL` | Blocks real file uploads in [Sprint 1, Task 1.5](sprints/sprint-01-auth-onboarding/task-5-tutor-profile-completion.md) — `STORAGE_PROVIDER=local` lets that sprint build/test against local disk in the meantime |
| 8 | **Mixpanel or Amplitude** | Product/funnel analytics (Firebase Analytics is bundled free with #1) | Not yet scaffolded — add when Sprint 8 wires the tracking plan | Non-blocking until [Sprint 8, Task 8.5](sprints/sprint-08-hardening-launch/task-5-analytics-error-monitoring.md) |
| 9 | **Railway or Render** | API hosting (staging/production) | N/A (deploy-time secrets, see [docs/infrastructure.md](infrastructure.md)) | Blocks live staging/production deploys |
| 10 | **Vercel** | Web/admin hosting (staging/production) | N/A | Blocks live staging/production deploys |
| 11 | **GitHub remote** | So the CI/CD workflows in `.github/workflows/` can actually run | N/A | Blocks all of [Task 0.2](sprints/sprint-00-foundation/task-2-cicd-pipeline.md)'s live behavior |

## Setup steps per service

1. **Firebase**: console.firebase.google.com → create project → Authentication → enable Phone and Google providers → Project Settings → generate a service account key (for `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`) → register a Web App (for the `NEXT_PUBLIC_FIREBASE_*` client config).
2. **Midtrans**: midtrans.com → register → start with Sandbox credentials (instant) → submit business verification for production credentials in parallel, since approval takes days.
3. **Stream Chat**: getstream.io → create a Chat app → copy API key/secret.
3b. **Daily.co** (Phase 2 in-app video): daily.co → create account → Developers → copy API key into `DAILY_API_KEY`. Without it, tutors keep pasting Zoom/Meet links; “Buka ruang sesi” will error with a clear message.
4. **WhatsApp BSP**: evaluate Woztell/Qontak/Twilio → register business → WhatsApp Business API approval (Meta-side verification, can take 1-2 weeks) → start this one first given the lead time.
5. **Sentry**: sentry.io → create one project per app (`api`, `web`, `admin`; mobile project once Flutter resumes) → copy DSNs.
6. **Google Maps Platform**: console.cloud.google.com → enable Geocoding API + Places API → create an API key → restrict it (HTTP referrer for web, package name for Android once mobile resumes).
7. **Cloudinary**: cloudinary.com → create account → copy the `CLOUDINARY_URL` connection string. Or skip and keep `STORAGE_PROVIDER=local`/Firebase Storage if MVP photo/document volume doesn't justify it yet.
8. **Mixpanel/Amplitude**: pick one (not both) when Sprint 8 starts.
9-10. **Railway/Render + Vercel**: see [docs/infrastructure.md](infrastructure.md) for the exact steps and which GitHub secrets to set afterward.
11. **GitHub remote**: `git remote add origin <url> && git push -u origin main`, then configure branch protection (require the `Lint, Test, Build` check before merge) and the `production` Environment with required reviewers.

## What the codebase does in the meantime

Every integration point reads its credentials from environment variables and none of them are hardcoded as required at boot — `services/api` starts and its `/api/health` endpoint works with zero third-party credentials configured, verified in [Sprint 0's changes.md](sprints/sprint-00-foundation/changes.md). As each sprint builds the feature that actually needs one of these services, it either mocks the integration for local dev (e.g. console-logged "emails" via `EMAIL_PROVIDER=console`) or documents the sandbox credentials needed to exercise it — check that sprint's own `changes.md` for specifics.
