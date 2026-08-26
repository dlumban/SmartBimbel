# SmartBimbel — Sprint Plan

Source of truth for scope: [`../PRD.md`](../PRD.md). This plan turns PRD sections 6–10 into 9 delivery sprints (~18 weeks, matching the PRD's Phase 0 + Phase 1 roadmap).

## Architectural Approach

The PRD leaves the stack recommended but not the delivery architecture. Decisions made here, to keep MVP scope buildable by a small team without foreclosing scale-up:

- **Backend: modular monolith, not microservices.** One NestJS service with clearly separated modules (`auth`, `users`, `tutors`, `students`, `subjects`, `availability`, `bookings`, `chat`, `payments`, `payouts`, `reviews`, `notifications`, `admin`). Microservices add operational overhead the MVP doesn't need; module boundaries make future extraction possible if a specific service (e.g. notifications, payments) needs to scale independently later.
- **Repo layout: single repo, multiple apps.** `apps/mobile` (Flutter), `apps/web` (Next.js, student/tutor-facing), `apps/admin` (Next.js, internal), `services/api` (NestJS), `packages/shared` (TS types/DTOs shared between web, admin, and API). Flutter doesn't share a JS package manager with the rest, so it stays a sibling folder, not a workspace package.
- **Database: PostgreSQL + Prisma.** Prisma over TypeORM for migration ergonomics and type safety with a small team. Redis for caching, session/rate-limit state, and BullMQ job queues (notifications, payout batches, webhook retries).
- **Auth: Firebase Auth** for phone OTP + Google login (avoids building/maintaining an SMS OTP pipeline for Indonesian carriers in-house). Backend verifies Firebase ID tokens on each request and mirrors identity into the platform's own `User` table on first login, since booking/payment/rating data all needs to live in Postgres regardless of auth provider.
- **Chat: managed provider (Stream Chat) for MVP**, not self-hosted Socket.io. Buys real-time messaging, delivery receipts, and moderation tooling without building infra the platform doesn't yet need to own. Revisit self-hosting only if cost becomes a problem post-PMF.
- **Payments: Midtrans** as primary gateway (broadest local QRIS/e-wallet/VA coverage, mature docs, common in Indonesian marketplaces). Xendit stays a documented fallback if underwriting/onboarding with Midtrans stalls.
- **Notifications:** FCM (push) + WhatsApp Business API via a BSP (e.g. Woztell/Qontak — evaluated in Sprint 0) + email (SES/SendGrid) as fallback, orchestrated through a single `notifications` module so booking/payment events don't hardcode channel logic into feature modules.
- **Hosting:** Railway/Render for API + Postgres + Redis (fast to provision, cheap at MVP scale), Vercel for `web` and `admin`, Firebase Storage or Cloudinary for tutor photos/documents.
- **Sequencing logic:** Discovery (read-heavy, no money movement) is built before Booking. Booking is built before Payments, because payment only makes sense once there's a confirmed booking to attach it to. Chat can be built in parallel with Booking once the module boundary (conversation tied to a booking) is agreed. A **minimal, DB-level tutor approval toggle** is needed as early as Sprint 1 so tutors can go live before the full Admin Panel (Sprint 7) exists — called out explicitly in that sprint's tasks.

## Sprint Overview

| Sprint | Theme | Duration | PRD Section(s) |
|---|---|---|---|
| [Sprint 0](sprint-00-foundation/README.md) | Foundation & Tech Setup | 2 weeks | §9, §10 |
| [Sprint 1](sprint-01-auth-onboarding/README.md) | Authentication & Onboarding | 2 weeks | §6.1.A |
| [Sprint 2](sprint-02-discovery/README.md) | Tutor Discovery & Search | 2 weeks | §6.1.B |
| [Sprint 3](sprint-03-booking/README.md) | Booking & Scheduling | 2 weeks | §6.1.C |
| [Sprint 4](sprint-04-messaging/README.md) | In-App Messaging | 1.5 weeks | §6.1.D |
| [Sprint 5](sprint-05-payments/README.md) | Payments & Payouts | 2.5 weeks | §6.1.E |
| [Sprint 6](sprint-06-sessions-reviews/README.md) | Session Management & Reviews | 1.5 weeks | §6.1.F, §6.1.G |
| [Sprint 7](sprint-07-admin-panel/README.md) | Admin Panel | 2 weeks | §6.1.H |
| [Sprint 8](sprint-08-hardening-launch/README.md) | Hardening & Soft Launch | 2 weeks | §7, §13 |

Each sprint folder has a `README.md` (goals, scope, dependencies, exit criteria) and one markdown file per task. Task files include acceptance criteria and technical notes so they can be picked up directly as engineering tickets.

## Out of Scope for This Plan

Everything in PRD §6.2 (Post-MVP / Phase 2) — packages/subscriptions, recurring bookings, multi-child accounts, progress reports, referrals, verification badges, group sessions — is intentionally excluded. Revisit after the MVP success metrics in PRD §3 are being tracked and the transaction loop (Discover → Book → Pay → Complete → Review) is proven end-to-end.
