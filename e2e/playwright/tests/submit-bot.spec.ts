/**
 * E2E test: trigger an Action.Submit via Adaptive Card button click in Teams.
 *
 * The test bot sends an Adaptive Card with Action.Submit when it receives "submit".
 * Clicking the card's "Send" button triggers a message activity with flat activity.value.
 * The bot detects the value and replies "Submit received: {value}".
 *
 * Prerequisites:
 *   1. Run `npm run setup` to authenticate with Teams
 *   2. Have the test bot running with the submit handler
 *   3. Set TEAMS_BOT_NAME in .env
 */
import { test, expect } from "@playwright/test";
import {
  assertStorageStateValid,
  ensureTeamsLoaded,
  navigateToBotChat,
  sendRawMessage,
} from "../teams-helpers";

const BOT_NAME = process.env.TEAMS_BOT_NAME || "EchoBot";

test.beforeEach(async () => {
  assertStorageStateValid();
});

test("action.submit echoes value back as message", async ({ page }) => {
  await ensureTeamsLoaded(page);
  await navigateToBotChat(page, BOT_NAME);

  // Send "submit" to trigger the bot to send an Action.Submit card
  await sendRawMessage(page, "submit");

  // Wait for the card to render
  await page.waitForTimeout(5_000);

  // Scroll to the bottom of the chat to ensure new messages are visible
  await page.keyboard.press("End");
  await page.waitForTimeout(2_000);

  // Find and click the "Send" button on the Action.Submit card
  let sendClicked = false;

  // Try page-level first
  const pageSend = page.getByText("Send", { exact: true }).last();
  if (await pageSend.isVisible().catch(() => false)) {
    await pageSend.click();
    sendClicked = true;
  }

  // If not found at page level, search frames
  if (!sendClicked) {
    for (const frame of page.frames()) {
      const btn = frame.getByText("Send", { exact: true }).last();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        sendClicked = true;
        break;
      }
    }
  }

  if (!sendClicked) {
    throw new Error(
      "Could not find Send button at page level or in any iframe. " +
        "Check that the bot sent an Action.Submit card in response to 'submit'."
    );
  }

  // Wait for the bot to reply with the submitted value
  const submitText = /Submit received/i;

  await expect(async () => {
    const pageVisible = await page
      .getByText(submitText)
      .last()
      .isVisible()
      .catch(() => false);
    if (pageVisible) return;

    for (const frame of page.frames()) {
      const frameVisible = await frame
        .getByText(submitText)
        .last()
        .isVisible()
        .catch(() => false);
      if (frameVisible) return;
    }
    expect(false).toBe(true);
  }).toPass({ timeout: 30_000 });
});
