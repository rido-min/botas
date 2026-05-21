/**
 * E2E test: counter command with user-scoped state in Teams.
 *
 * The test bot maintains a per-user counter that increments with each "counter" command.
 * Sending "reset" clears the counter back to 1 for that user.
 *
 * Prerequisites:
 *   1. Run `npm run setup` to authenticate with Teams
 *   2. Have the test bot running with the counter handler
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

test("counter increments and resets for user", async ({ page }) => {
  await ensureTeamsLoaded(page);
  await navigateToBotChat(page, BOT_NAME);

  // Send "counter" — expect "Count: 1"
  await sendRawMessage(page, "counter");
  await page.waitForTimeout(2_000);
  
  // Wait for the first counter reply
  const count1Pattern = /^Count: 1$/;
  await expect(async () => {
    const count1Visible = await page
      .getByText(count1Pattern)
      .last()
      .isVisible()
      .catch(() => false);
    expect(count1Visible).toBe(true);
  }).toPass({ timeout: 15_000 });

  // Send "counter" again — expect "Count: 2"
  await sendRawMessage(page, "counter");
  await page.waitForTimeout(2_000);

  const count2Pattern = /^Count: 2$/;
  await expect(async () => {
    const count2Visible = await page
      .getByText(count2Pattern)
      .last()
      .isVisible()
      .catch(() => false);
    expect(count2Visible).toBe(true);
  }).toPass({ timeout: 15_000 });

  // Send "counter" a third time — expect "Count: 3"
  await sendRawMessage(page, "counter");
  await page.waitForTimeout(2_000);

  const count3Pattern = /^Count: 3$/;
  await expect(async () => {
    const count3Visible = await page
      .getByText(count3Pattern)
      .last()
      .isVisible()
      .catch(() => false);
    expect(count3Visible).toBe(true);
  }).toPass({ timeout: 15_000 });

  // Send "reset" — expect "Counter reset"
  await sendRawMessage(page, "reset");
  await page.waitForTimeout(2_000);

  const resetPattern = /^Counter reset$/;
  await expect(async () => {
    const resetVisible = await page
      .getByText(resetPattern)
      .last()
      .isVisible()
      .catch(() => false);
    expect(resetVisible).toBe(true);
  }).toPass({ timeout: 15_000 });

  // Send "counter" again — expect "Count: 1" (proves reset worked)
  await sendRawMessage(page, "counter");
  await page.waitForTimeout(2_000);

  const count1AfterResetPattern = /^Count: 1$/;
  await expect(async () => {
    const count1AfterResetVisible = await page
      .getByText(count1AfterResetPattern)
      .last()
      .isVisible()
      .catch(() => false);
    expect(count1AfterResetVisible).toBe(true);
  }).toPass({ timeout: 15_000 });
});
