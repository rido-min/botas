/**
 * Setup fixture for the Python bot project.
 * Starts the Python bot before tests and stops it after.
 */
import { test as setup } from "@playwright/test";
import { loadEnv, startPythonBot } from "./bot-lifecycle";

setup.beforeAll(async () => {
  loadEnv();
  await startPythonBot();
});
