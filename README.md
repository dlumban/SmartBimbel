# SmartBimbel

Private tutor marketplace for Indonesia — connecting students/parents with verified private tutors for flexible, one-on-one learning, online or offline.

Full product context lives in [docs/PRD.md](docs/PRD.md). Delivery plan and task-by-task specs live in [docs/sprints](docs/sprints/README.md). Each sprint folder's `changes.md` is the running log of what was actually built against that plan.

## Stack

- **API:** NestJS (`services/api`) + PostgreSQL (Prisma) + Redis
- **Web:** Next.js (`apps/web` — student/tutor facing, `apps/admin` — internal)
- **Mobile:** Flutter (`apps/mobile` — currently deferred, see its README)
- **Shared:** `packages/shared` (types/DTOs), `packages/design-tokens` (design system tokens)

## Features

### For students

- Sign up / log in via Google, or email + password (Firebase Auth)
- Complete a profile (grade level, preferred subjects, location, teaching mode)
- Search and filter tutors by subject, grade level, city, teaching mode, and price
- View a tutor's profile, ratings, and reviews
- Book a session: propose a schedule, counter-propose, reschedule, or cancel
- Pay for a booked session (Midtrans — QRIS, e-wallet, virtual account, card)
- Chat with the tutor in-app per booking; report or block if needed
- Join the session via its meeting link
- Mark a session complete and leave a rating/review
- Raise a dispute or report a problem with a booking
- View booking history and status
- Opt out of WhatsApp notifications (push/email always on)

### For tutors

- Sign up / log in via Google, or email + password (Firebase Auth)
- Submit a tutor profile for admin verification (bio, education, subjects, grade levels, hourly rate, teaching mode, city, KTP document upload)
- Track verification status (pending / verified / rejected with reason) and resubmit if rejected
- Manage a weekly availability schedule
- Receive and respond to booking requests: accept, decline, counter-propose, accept/decline a reschedule
- Set a meeting link for online sessions
- Chat with the student in-app per booking
- Mark a session complete and add session notes, with inline images and document attachments (PDF/Word)
- View an earnings dashboard and export earnings
- Set bank details and request a payout
- Receive ratings/reviews from students
- Raise or respond to disputes
- Add a student directly (an offline referral/walk-in, no sign-up required), edit that student's details, and generate an access link so they can sign in without registering — private to the tutor who added them; the link stays valid until the tutor deactivates it

Feature scope and delivery order are tracked sprint-by-sprint in [docs/sprints](docs/sprints/README.md); full product rationale is in [docs/PRD.md](docs/PRD.md).

## Running locally

Prerequisites: Node 20+, pnpm 9+, Docker.

```bash
pnpm install
docker compose up -d                              # Postgres (5433) + Redis (6380)
pnpm --filter @smartbimbel/api prisma:generate
pnpm --filter @smartbimbel/api prisma:migrate      # applies migrations to the dev DB
```

Copy each app's `.env.example` to `.env` (`services/api`) or `.env.local` (`apps/web`, `apps/admin`) and fill in local/sandbox values — see [docs/infrastructure.md](docs/infrastructure.md) for how to obtain Firebase/Midtrans/Stream credentials.

Then start everything at once:

```bash
pnpm dev   # builds packages/shared + packages/design-tokens, then runs api/web/admin in watch mode
```

Or start services individually:

```bash
pnpm --filter @smartbimbel/api dev     # http://localhost:4000/api  (health: /api/health)
pnpm --filter @smartbimbel/web dev     # http://localhost:3000
pnpm --filter @smartbimbel/admin dev   # http://localhost:3001
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for repo layout, branching, and PR conventions.
