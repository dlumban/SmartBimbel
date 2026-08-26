import { defineConfig } from "vitest/config";

export default defineConfig({
  // apps/web's tsconfig.json sets "jsx": "preserve" for Next's own SWC
  // compiler - Vitest's esbuild transform needs its own explicit setting or
  // it leaves raw JSX in place ("React is not defined" at test time).
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    passWithNoTests: true,
    // e2e/** is Playwright's suite (Task 8.1) - a separate runner against
    // a live server, not a vitest/jsdom component test.
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
