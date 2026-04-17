import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "https://teams.microsoft.com",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      timeout: 180_000,
      use: {
        channel: "msedge",
        headless: false,
        actionTimeout: 180_000,
      },
    },
    {
      name: "teams-tests",
      testMatch: /tests[\\\/].*\.spec\.ts/,
      use: {
        channel: "msedge",
        storageState: "storageState.json",
      },
      // Do NOT depend on auth-setup — run `npm run setup` separately
    },
  ],
});
