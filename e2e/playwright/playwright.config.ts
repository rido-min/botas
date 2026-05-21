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
  globalTeardown: require.resolve("./global-teardown.ts"),
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
      name: "dotnet-tests",
      testMatch: /tests[\\\/].*\.spec\.ts/,
      use: {
        channel: "msedge",
        storageState: "storageState.json",
      },
      dependencies: ["dotnet-setup"],
    },
    {
      name: "dotnet-setup",
      testMatch: /dotnet\.setup\.ts/,
      teardown: "dotnet-teardown",
    },
    {
      name: "dotnet-teardown",
      testMatch: /global-teardown\.ts/,
    },
    {
      name: "node-tests",
      testMatch: /tests[\\\/].*\.spec\.ts/,
      use: {
        channel: "msedge",
        storageState: "storageState.json",
      },
      dependencies: ["node-setup"],
    },
    {
      name: "node-setup",
      testMatch: /node\.setup\.ts/,
      teardown: "node-teardown",
    },
    {
      name: "node-teardown",
      testMatch: /global-teardown\.ts/,
    },
    {
      name: "python-tests",
      testMatch: /tests[\\\/].*\.spec\.ts/,
      use: {
        channel: "msedge",
        storageState: "storageState.json",
      },
      dependencies: ["python-setup"],
    },
    {
      name: "python-setup",
      testMatch: /python\.setup\.ts/,
      teardown: "python-teardown",
    },
    {
      name: "python-teardown",
      testMatch: /global-teardown\.ts/,
    },
  ],
});
