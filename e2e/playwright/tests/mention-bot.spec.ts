/**
 * E2E test: send "mention" and verify the bot replies with an @mention of the sender.
 *
 * The test bot uses TeamsActivityBuilder.addMention() to create a mention entity,
 * then replies with "<at>DisplayName</at> said: mention [nonce]".
 * In the Teams UI the <at> tag renders as a styled mention — we verify the
 * visible text "said: mention" plus the nonce to avoid stale-history matches.
 *
 * Prerequisites:
 *   1. Run `npm run setup` to authenticate with Teams
 *   2. Have the test bot running with the mention handler
 *   3. Set TEAMS_BOT_NAME in .env
 */
import { test, expect } from "@playwright/test";
import {
  assertStorageStateValid,
  ensureTeamsLoaded,
  navigateToBotChat,
  sendMessage,
} from "../teams-helpers";

const BOT_NAME = process.env.TEAMS_BOT_NAME || "EchoBot";

test.beforeEach(async () => {
  assertStorageStateValid();
});

test("mention reply contains @mention of sender", async ({ page }) => {
  await ensureTeamsLoaded(page);
  await navigateToBotChat(page, BOT_NAME);

  // sendMessage appends a nonce: "mention [abcd1234]"
  // The bot echoes the full text back, so we can match on the nonce
  const sentText = await sendMessage(page, "mention");
  const nonceMatch = sentText.match(/\[([a-f0-9]+)\]/);
  const nonce = nonceMatch![1];

  // The bot replies: "<at>DisplayName</at> said: mention [nonce]"
  // Teams renders the <at> tag as a mention span, so visible text is:
  //   "DisplayName said: mention [nonce]"
  const replyPattern = new RegExp(`said:.*mention.*${nonce}`, "i");

  await expect(async () => {
    const pageVisible = await page
      .getByText(replyPattern)
      .last()
      .isVisible()
      .catch(() => false);
    if (pageVisible) return;

    for (const frame of page.frames()) {
      const frameVisible = await frame
        .getByText(replyPattern)
        .last()
        .isVisible()
        .catch(() => false);
      if (frameVisible) return;
    }
    expect(false).toBe(true);
  }).toPass({ timeout: 30_000 });
});
