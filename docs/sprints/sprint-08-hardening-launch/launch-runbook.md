# Launch Runbook (Task 8.6)

For the soft-launch window in the chosen initial cities (city selection itself is a business decision — see "Known deferred items" in `changes.md`). Covers on-call coverage, escalation, and where to look when something breaks.

## On-call coverage

- One engineer on-call for the launch window (recommended: the full first week live in a city, tapering to standard business-hours coverage once booking volume stabilizes — exact duration is a product/ops call, not an engineering one).
- Primary escalation contact and rotation schedule: **to be filled in by whoever owns on-call scheduling** — this runbook defines the *process*, not the roster, since no team/scheduling tool is set up in this engineering environment.

## Where to look first

| Signal | Where |
|---|---|
| Application errors (500s, unhandled exceptions) | Sentry dashboard (Task 8.5) — `SentryExceptionFilter` reports every 5xx from `services/api`; `sentry.client/server/edge.config.ts` cover `apps/web`/`apps/admin`. Inert until `SENTRY_DSN` is configured for the target environment. |
| Platform metrics (bookings, GMV, conversion) | `apps/admin`'s Analytics Dashboard (Task 7.6) — `/internal/analytics/summary` and `/cities`. |
| A specific user's booking/payment/dispute | `apps/admin`'s Users/Bookings/Transactions/Disputes management screens (Sprint 7) — every admin action here is audit-logged (`AuditLog`, `GET /internal/audit-log`). |
| Background job health (booking expiry, payment expiry, session auto-complete, reminders) | BullMQ queues (`services/api/src/jobs/jobs.module.ts`) — no dashboard is wired up yet (e.g. Bull Board); this is the clearest engineering gap this runbook surfaces. Recommended before launch: add a queue-monitoring UI, or at minimum structured logging on job failure. |
| Payment gateway status | Midtrans's own dashboard (external, once real sandbox/production credentials are provisioned — none exist in this environment, see `docs/third-party-setup.md`). |

## Escalation path for payment/booking incidents

1. **Payment discrepancy** (student charged, booking not confirmed, or vice versa): check `AdminTransactionsController`'s reconciliation view (`GET /internal/transactions/reconciliation`, Task 7.4) first — it flags `PENDING` transactions stuck past the payment window, the most common failure mode (webhook delivery gap or a stuck job). Cross-reference against Midtrans's own dashboard for the ground truth before taking any manual action on the transaction.
2. **Stuck booking** (student/tutor reports a booking not progressing): `AdminBookingsController`'s detail view shows full status history (`BookingStatusHistory`); an admin can manually override-cancel (Super Admin only) if the booking is genuinely stuck and a refund is warranted — this always goes through `DisputesService`'s resolve-with-refund path, never a direct DB edit.
3. **Suspected abuse/fraud**: suspend the account via `AdminUsersController` (`PATCH /internal/users/:id/suspend`) — takes effect immediately since `FirebaseAuthGuard` rejects `SUSPENDED` users at the auth boundary on their very next request.
4. **Data correctness issue traced to a bug, not user error**: file it, do **not** hot-patch data directly in production Postgres outside of the admin tooling above — every admin-facing mutation path is audit-logged and validated (DTOs, state-machine transitions); a raw SQL fix bypasses both and is much more likely to leave the system in a state the application code doesn't expect.

## Monitoring dashboard links

Placeholders — filled in once each service is actually provisioned in a real environment (none are provisioned here, per Task 8.5's scope):

- Sentry project: `<url once SENTRY_DSN is set and the project exists>`
- Firebase Analytics: `<url once NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID is set>`
- Postgres/Redis infra monitoring: `<url once a managed hosting provider is chosen>`

## What this environment could not verify

This runbook is a process document, not a rehearsed drill — there's no staging environment or real on-call tooling (PagerDuty/Opsgenie/Slack integration) in this engineering session to test the escalation flow end to end. Before the real soft launch: run at least one incident-response tabletop exercise with whoever ends up on the rotation, and wire up the queue-monitoring gap noted above.
