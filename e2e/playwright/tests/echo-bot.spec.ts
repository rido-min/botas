/**
 * Prototype E2E test: send a message to the echo bot via Teams web and verify the reply.
 *
 * Prerequisites:
 *   1. Run `npm run setup` to authenticate with Teams (interactive, MFA supported)
 *   2. Have the echo bot running and registered in Teams (see specs/setup.md)
 *   3. Set TEAMS_BOT_NAME in .env to the bot's display name
 *
 * Run with:  npm test
 */
import { test, expect } from "@playwright/test";
import {
  assertStorageStateValid,
  ensureTeamsLoaded,
  navigateToBotChat,
  sendMessage,
  waitForBotReply,
} from "../teams-helpers";

const BOT_NAME = process.env.TEAMS_BOT_NAME || "EchoBot";

test.beforeEach(async () => {
  assertStorageStateValid();
});

test("echo bot replies with the sent message", async ({ page }) => {
  // Ensure we're logged into Teams
  await ensureTeamsLoaded(page);

  // Navigate to the bot's 1:1 chat
  await navigateToBotChat(page, BOT_NAME);

  // Send a unique message
  const sentText = await sendMessage(page, "hello from playwright");

  // Wait for the bot's echo reply
  const replyText = await waitForBotReply(page, sentText);

  // The echo bot should reply with a message containing our original text
  expect(replyText.toLowerCase()).toContain("hello from playwright");
  // Verify the nonce is in the reply (proves it's not a stale message)
  const nonceMatch = sentText.match(/\[([a-f0-9]+)\]/);
  expect(replyText).toContain(nonceMatch![1]);
});
