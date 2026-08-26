import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest.config.ts doesn't enable global test APIs, so Testing Library's
// automatic afterEach(cleanup) registration (which relies on a global
// afterEach) never fires - unmounted components from a previous test were
// leaking into the next one's DOM. Register it explicitly instead.
afterEach(() => {
  cleanup();
});
