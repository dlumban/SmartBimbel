import { defineConfig } from "vitest/config";

export default defineConfig({
  // apps/admin's tsconfig.json sets "jsx": "preserve" for Next's own SWC
  // compiler - Vitest's esbuild transform needs its own explicit setting or
  // it leaves raw JSX in place ("React is not defined" at test time). Same
  // fix applied to apps/web after hitting this for real there.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    passWithNoTests: true,
  },
});
