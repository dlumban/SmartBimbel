import * as Sentry from "@sentry/node";

/**
 * Error monitoring (Task 8.5) - same gated pattern as every other
 * third-party integration in this project (Firebase, Midtrans, Stream):
 * a real SDK, initialized for real, that simply never activates without
 * a configured DSN. No `SENTRY_DSN` is provisioned in this environment
 * (docs/third-party-setup.md), so this is structurally correct and
 * tested against its own unconfigured state, not live-verifiable here.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // eslint-disable-next-line no-console
    console.warn("SENTRY_DSN not set - error monitoring is disabled.");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // 10% trace sampling - enough to spot systemic latency issues without
    // paying full APM overhead on every request at MVP scale.
    tracesSampleRate: 0.1,
  });
}

export function isSentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN);
}
