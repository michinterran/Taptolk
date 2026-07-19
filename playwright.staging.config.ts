import { defineConfig, devices } from "@playwright/test";
import { loadStagingEnvironment } from "./e2e/staging/staging-fixture";

const port = 3200;

loadStagingEnvironment();

export default defineConfig({
  testDir: "./e2e/staging",
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 240_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: `http://localhost:${port}`,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "staging-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `corepack pnpm build:packages && corepack pnpm --filter @taptolk/web dev --hostname 127.0.0.1 --port ${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://localhost:${port}`,
  },
});
