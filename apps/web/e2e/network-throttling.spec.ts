import { test, expect } from "@playwright/test";

// Task 8.2's AC: "Tutor discovery list loads in under 3 seconds on a
// throttled 4G connection." Real CDP-level network emulation (Chrome
// DevTools Protocol's Network.emulateNetworkConditions), not a rough
// approximation - the same mechanism Chrome DevTools' own throttling
// presets use. Numbers below match Lighthouse's "Slow 4G" preset
// (1.6 Mbps down / 750 Kbps up / 150ms RTT), the conservative end of
// real 4G per PRD §7 - a page that clears 3s here comfortably clears it
// on a better connection too.
test.describe("4G network throttling (Task 8.2)", () => {
  test("tutor discovery list loads under 3s on a throttled 4G connection", async ({ page, context }) => {
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });

    const start = Date.now();
    await page.goto("/tutors", { waitUntil: "networkidle" });
    await expect(page.getByText("Budi Santoso")).toBeVisible();
    const elapsedMs = Date.now() - start;

    // eslint-disable-next-line no-console
    console.log(`Tutor discovery list loaded in ${elapsedMs}ms under simulated Slow 4G.`);
    expect(elapsedMs).toBeLessThan(3000);
  });
});
