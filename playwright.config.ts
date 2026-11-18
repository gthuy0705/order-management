import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Same rule as vitest.config.mts: .env is only a fallback for variables that
// are not already set (e.g. in CI).
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

// E2E tests create orders, so they run against the test database, never dev.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL phải được đặt và khác DATABASE_URL.");
}

const PORT = 3200;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // One shared database: run tests one at a time so totals are predictable.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "e2e",
      testMatch: "**/*.spec.ts",
      testIgnore: "**/screenshots.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "screenshots",
      testMatch: "**/screenshots.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // A production build: closer to what users get and no dev overlay in
    // screenshots. Uses its own port so it can run next to `npm run dev`.
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/orders/new`,
    env: { DATABASE_URL: testDatabaseUrl },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
