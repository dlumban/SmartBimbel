import { test, expect } from "@playwright/test";

/**
 * Real browser coverage for pages that don't require login - the only
 * part of the happy path this environment's frontend can drive through
 * an actual rendered UI, since there's no real Firebase project (see
 * docs/sprints/sprint-08-hardening-launch/changes.md, Task 8.1). Asserts
 * against prisma/seed.ts's real seeded tutors, not fixtures created by
 * this suite.
 */
test.describe("Public pages (real browser)", () => {
  test("landing page offers search and login entry points", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Temukan tutor privat terbaik" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cari Tutor" })).toBeVisible();
    await expect(page.getByText("Masuk / Daftar")).toBeVisible();
  });

  test("tutor discovery lists verified seed tutors and excludes unverified ones", async ({ page }) => {
    await page.goto("/tutors");
    await expect(page.getByText("Budi Santoso")).toBeVisible();

    // Task 8.1's edge-case matrix: unverified-tutor invisibility. Tono
    // Pratama (PENDING) and Dewi Lestari (REJECTED) are seeded
    // specifically to prove this (see discovery.e2e-spec.ts).
    await expect(page.getByText("Tono Pratama")).toHaveCount(0);
    await expect(page.getByText("Dewi Lestari")).toHaveCount(0);
  });

  test("tutor discovery search narrows results by city", async ({ page }) => {
    await page.goto("/tutors");
    await expect(page.getByText("Budi Santoso")).toBeVisible();

    await page.getByLabel("Kota").selectOption({ label: "Surabaya" });
    await expect(page.getByText("Andi Wijaya")).toBeVisible();
    await expect(page.getByText("Budi Santoso")).toHaveCount(0);
  });

  test("tutor detail page shows profile info and a booking entry point", async ({ page }) => {
    await page.goto("/tutors");
    await page.getByText("Budi Santoso").click();

    await expect(page).toHaveURL(/\/tutors\/.+/);
    await expect(page.getByRole("heading", { name: "Budi Santoso" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pesan Sekarang" })).toBeVisible();
  });
});
