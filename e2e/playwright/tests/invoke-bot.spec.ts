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
  sendMessage,
} from "../teams-helpers";

const BOT_NAME = process.env.TEAMS_BOT_NAME || "EchoBot";

test.beforeEach(async () => {
  assertStorageStateValid();
});

test("adaptive card invoke updates the card", async ({ page }) => {
  await ensureTeamsLoaded(page);
  await navigateToBotChat(page, BOT_NAME);

  // Send "card" to trigger the bot to send an Adaptive Card
  await sendMessage(page, "card");

  // Wait for the Adaptive Card to appear with the Submit button
  const submitButton = page.getByRole("button", { name: "Submit" }).last();
  await expect(submitButton).toBeVisible({ timeout: 15_000 });

  // Click the Submit button to trigger the invoke
  await submitButton.click();

  // Wait for the card to update with the invoke response
  const invokeResult = page.getByText("Invoke received!").last();
  await expect(invokeResult).toBeVisible({ timeout: 15_000 });
});
