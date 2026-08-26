import { defineConfig, devices } from "@playwright/test";

// Dev/test-only credential (never a real secret) - mirrors the "fake
// server key" convention already used in services/api/test's Jest e2e
// suite (e.g. payments-webhook.e2e-spec.ts's FAKE_SERVER_KEY). Threaded
// into the API webServer's env below so FirebaseAdminService's E2E
// bypass (see services/api/src/auth/firebase-admin.service.ts) accepts
// tokens minted with the same value in e2e/helpers.ts.
export const E2E_AUTH_BYPASS_SECRET = "playwright-e2e-secret-never-used-in-prod";

export const API_URL = "http://localhost:4000/api";
const WEB_URL = "http://localhost:3000";

// API-level + public-page E2E suite (Task 8.1). See docs/sprints/
// sprint-08-hardening-launch/changes.md for what this suite covers and,
// just as importantly, what it deliberately doesn't (full authenticated
// browser-UI flows - this environment's frontend auth is 100% driven by
// the real Firebase client SDK with no test seam, and mobile/Flutter,
// never built in this project).
export default defineConfig({
  testDir: "./e2e",
  // network-throttling.spec.ts needs a production build to give a
  // meaningful number (next dev's unbundled/unminified JS makes a
  // throttled-network load time measurement meaningless - see
  // playwright.perf.config.ts, which runs it separately against `next
  // start`).
  testIgnore: ["**/network-throttling.spec.ts"],
  globalTeardown: "./e2e/global-teardown.ts",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm dev",
      cwd: "../../services/api",
      url: `${API_URL}/health`,
      timeout: 120_000,
      reuseExistingServer: true,
      env: {
        ...process.env,
        E2E_AUTH_BYPASS_SECRET,
      },
    },
    {
      command: "pnpm dev",
      cwd: ".",
      url: WEB_URL,
      timeout: 120_000,
      reuseExistingServer: true,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
