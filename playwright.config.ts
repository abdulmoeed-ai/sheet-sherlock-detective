import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8080";
const apiURL = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8000";
const frontendUrl = new URL(baseURL);
const backendUrl = new URL(apiURL);
const databaseURL =
  process.env.DATABASE_URL ?? "postgresql+asyncpg://sheet_sherlock:sheet_sherlock@localhost:5433/sheet_sherlock";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: `uv run python -m fastapi dev --host ${backendUrl.hostname} --port ${backendUrl.port || "8000"}`,
      cwd: "../backend_code/backend",
      url: `${apiURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        LOG_LEVEL: process.env.LOG_LEVEL ?? "debug",
        DATABASE_URL: databaseURL,
        CORS_ORIGINS: JSON.stringify([baseURL, "http://127.0.0.1:8080", "http://localhost:8080"]),
        EMAIL_NOTIFICATIONS_ENABLED: "false",
        RESEND_API_KEY: "",
      },
    },
    {
      command: `VITE_API_BASE_URL=${apiURL} bun dev --host ${frontendUrl.hostname} --port ${frontendUrl.port || "8080"}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: apiURL,
        VITE_E2E_GOOGLE_API_KEY_PRESENT: process.env.GOOGLE_API_KEY ? "true" : "false",
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
