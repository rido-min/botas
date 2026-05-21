/**
 * Setup fixture for the .NET bot project.
 * Starts the .NET bot before tests and stops it after.
 */
import { test as setup } from "@playwright/test";
import { loadEnv, startDotNetBot } from "./bot-lifecycle";

setup.beforeAll(async () => {
  loadEnv();
  await startDotNetBot();
});
