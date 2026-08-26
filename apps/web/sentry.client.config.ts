import * as Sentry from "@sentry/nextjs";

// Error monitoring (Task 8.5) - same gated pattern as every other
// third-party integration in this project: Sentry's own SDK already
// no-ops safely when `dsn` is undefined, which is the real state here
// (no NEXT_PUBLIC_SENTRY_DSN provisioned - docs/third-party-setup.md).
// Source-map upload (for readable production stack traces) needs a
// SENTRY_AUTH_TOKEN/org/project this environment doesn't have either -
// deferred alongside the DSN itself, not attempted blind.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
