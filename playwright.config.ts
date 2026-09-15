import { defineConfig, devices } from "@playwright/test";
import { E2E, appServerEnv } from "./tests/e2e/env";

const isCI = !!process.env.CI;

/**
 * Two projects, one flow each:
 *   api — HTTP only, minted session. Backend truth.
 *   ui  — Chromium, minted session. Frontend on top of a known backend.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/seed.ts",
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  expect: { timeout: 15_000 },
  use: {
    baseURL: E2E.baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "api", testMatch: /\.api\.spec\.ts$/ },
    {
      name: "ui",
      testMatch: /\.ui\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: E2E.externalServer
    ? undefined
    : {
        // makes production build rather than 'next dev'
        command: "npm run build && npm run start",
        url: `${E2E.baseURL}/login`,
        env: appServerEnv(),
        reuseExistingServer: !isCI,
        timeout: 300_000,
      },
});
