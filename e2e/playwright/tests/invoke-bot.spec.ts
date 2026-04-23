/**
 * E2E test: trigger an invoke via Adaptive Card button click in Teams.
 *
 * The echo bot sends an Adaptive Card when it receives "card".
 * Clicking the card's "Submit" button triggers an adaptiveCard/action invoke.
 * The bot responds by updating the card to show "Invoke received!".
 *
 * Prerequisites:
 *   1. Run `npm run setup` to authenticate with Teams
 *   2. Have the echo bot running with the card/invoke handlers
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

test("adaptive card invoke updates the card", async ({ page }) => {
  await ensureTeamsLoaded(page);
  await navigateToBotChat(page, BOT_NAME);

  // Send "card" to trigger the bot to send an Adaptive Card
  await sendRawMessage(page, "card");

  // Wait for the card to render — give the bot time to respond
  // and Teams time to render the Adaptive Card
  await page.waitForTimeout(5_000);

  // Scroll to the bottom of the chat to ensure new messages are visible
  await page.keyboard.press("End");
  await page.waitForTimeout(2_000);

  // Find and click the Submit button — search both page and frames.
  // Teams may render Adaptive Cards in iframes or shadow DOM.
  let submitClicked = false;

  // Try page-level first
  const pageSubmit = page.getByText("Submit", { exact: true }).last();
  if (await pageSubmit.isVisible().catch(() => false)) {
    await pageSubmit.click();
    submitClicked = true;
  }

  // If not found at page level, search frames
  if (!submitClicked) {
    for (const frame of page.frames()) {
      const btn = frame.getByText("Submit", { exact: true }).last();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        submitClicked = true;
        break;
      }
    }
  }

  if (!submitClicked) {
    throw new Error(
      "Could not find Submit button at page level or in any iframe. " +
        "Check that the bot sent an Adaptive Card in response to 'card'."
    );
  }

  // Wait for the card to update with the invoke response
  await page.waitForTimeout(3_000);

  const invokeText = /Invoke received/i;

  // Search page + all frames for the result text
  await expect(async () => {
    const pageVisible = await page
      .getByText(invokeText)
      .last()
      .isVisible()
      .catch(() => false);
    if (pageVisible) return;

    for (const frame of page.frames()) {
      const frameVisible = await frame
        .getByText(invokeText)
        .last()
        .isVisible()
        .catch(() => false);
      if (frameVisible) return;
    }
    expect(false).toBe(true);
  }).toPass({ timeout: 30_000 });
});
