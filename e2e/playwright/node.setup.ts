/**
 * Setup fixture for the Node.js bot project.
 * Starts the Node.js bot before tests and stops it after.
 */
import { test as setup } from "@playwright/test";
import { loadEnv, startNodeBot } from "./bot-lifecycle";

setup.beforeAll(async () => {
  loadEnv();
  await startNodeBot();
});
