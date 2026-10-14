import { defineConfig, devices } from "@playwright/test";

const browserName = (process.env.E2E_BROWSER ?? "chromium") as "chromium" | "firefox" | "webkit";
const device = process.env.E2E_DEVICE ? devices[process.env.E2E_DEVICE] : undefined;
if (process.env.E2E_DEVICE && !device) {
  throw new Error(`Unknown E2E_DEVICE "${process.env.E2E_DEVICE}" (see Playwright's device list).`);
}

/**
 * Browser E2E against a real, isolated stack (see e2e/README.md). Nothing here
 * starts servers: the Backend must run on a throwaway database and the frontend
 * must point at it. e2e/global-setup.ts refuses to run otherwise.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    ...(device && {
      viewport: device.viewport,
      userAgent: device.userAgent,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
    }),
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    browserName,
    channel: browserName === "chromium" ? (process.env.E2E_BROWSER_CHANNEL ?? "chrome") : undefined,
    headless: true,
    locale: "fa-IR",
    timezoneId: "Asia/Tehran",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  outputDir: "./test-results/e2e",
});
