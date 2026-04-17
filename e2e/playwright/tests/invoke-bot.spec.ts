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

  // Adaptive Cards in Teams may render inside an iframe.
  // Try page-level first, then fall back to iframe.
  let submitButton = page.getByRole("button", { name: "Submit" }).last();
  let inIframe = false;

  try {
    await expect(submitButton).toBeVisible({ timeout: 30_000 });
  } catch {
    // Button not found at page level — try inside iframes
    const frames = page.frames();
    for (const frame of frames) {
      const btn = frame.getByRole("button", { name: "Submit" }).last();
      if (await btn.isVisible().catch(() => false)) {
        submitButton = btn;
        inIframe = true;
        break;
      }
    }
    if (!inIframe) {
      // Last resort: try any element with text "Submit"
      submitButton = page.getByText("Submit", { exact: true }).last();
      await expect(submitButton).toBeVisible({ timeout: 5_000 });
    }
  }

  // Click the Submit button to trigger the invoke
  await submitButton.click();

  // Wait for the card to update with the invoke response
  if (inIframe) {
    const frames = page.frames();
    for (const frame of frames) {
      const result = frame.getByText("Invoke received!").last();
      if (await result.isVisible({ timeout: 30_000 }).catch(() => false)) {
        break;
      }
    }
  } else {
    const invokeResult = page.getByText("Invoke received!").last();
    await expect(invokeResult).toBeVisible({ timeout: 30_000 });
  }
});
