import { defineConfig, devices } from "@playwright/test";
import { API_URL, E2E_AUTH_BYPASS_SECRET } from "./playwright.config";

const WEB_URL = "http://localhost:3000";

// Task 8.2's throttled-4G page-load AC needs a real production build -
// `next dev` ships unminified, unbundled JS that makes any network-
// throttled timing measurement meaningless (confirmed: ~23s under dev
// mode vs ~2.3s under `next start` for the same page/throttle profile).
// Separate from playwright.config.ts's fast dev-mode suite since
// rebuilding for every run is deliberately not part of the default
// `pnpm test:e2e` loop.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/network-throttling.spec.ts"],
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: WEB_URL },
  webServer: [
    {
      command: "pnpm dev",
      cwd: "../../services/api",
      url: `${API_URL}/health`,
      timeout: 120_000,
      reuseExistingServer: true,
      env: { ...process.env, E2E_AUTH_BYPASS_SECRET },
    },
    {
      command: "pnpm build && pnpm start",
      cwd: ".",
      url: WEB_URL,
      timeout: 180_000,
      reuseExistingServer: true,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
