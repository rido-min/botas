/**
 * Global teardown: stops the bot process after all tests complete.
 */
import { stopBot } from "./bot-lifecycle";

async function globalTeardown() {
  await stopBot();
}

export default globalTeardown;
