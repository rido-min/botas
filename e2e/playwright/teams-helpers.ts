/**
 * Reusable helpers for interacting with the Teams web client.
 *
 * Selectors use data-tid attributes where available (more stable than class names),
 * but Teams can change these at any time — centralizing them here makes maintenance easier.
 */
import { Page, expect } from "@playwright/test";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

/**
 * Fail fast if the storageState is missing or clearly expired.
 * Call this at the start of every test to give a clear error message.
 */
export function assertStorageStateValid(): void {
  const statePath = path.resolve(__dirname, "storageState.json");
  if (!fs.existsSync(statePath)) {
    throw new Error(
      "storageState.json not found. Run `npm run setup` to authenticate first."
    );
  }
  const stats = fs.statSync(statePath);
  const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
  if (ageHours > 24) {
    throw new Error(
      `storageState.json is ${ageHours.toFixed(0)}h old and likely expired. ` +
        "Run `npm run setup` to re-authenticate."
    );
  }
}

/**
 * Ensure we're actually logged into Teams and not on a login redirect.
 */
export async function ensureTeamsLoaded(page: Page): Promise<void> {
  await page.goto("https://teams.microsoft.com/");

  // Wait for a Teams-specific UI element that only shows after login
  try {
    const teamsLoaded = page
      .getByPlaceholder("Type a message")
      .or(page.getByPlaceholder("Type a new message"))
      .or(page.getByRole("button", { name: "Chat" }))
      .or(page.getByRole("button", { name: "Activity" }))
      .first();
    await teamsLoaded.waitFor({ state: "visible", timeout: 30_000 });
  } catch {
    const url = page.url();
    if (
      url.includes("login.microsoftonline.com") ||
      url.includes("login.live.com")
    ) {
      throw new Error(
        "Session expired — redirected to login page. Run `npm run setup` to re-authenticate."
      );
    }
    throw new Error(
      "Teams did not load within 30 seconds. Check your network and session state."
    );
  }
}

/**
 * Navigate to a 1:1 chat with the bot.
 * Clicks the bot entry in the Chat list sidebar — more reliable than search.
 */
export async function navigateToBotChat(
  page: Page,
  botName: string
): Promise<void> {
  // Ensure we're on the Chat tab first
  await page.getByRole("button", { name: "Chat" }).click();
  await page.waitForTimeout(1_000);

  // Click the bot in the chat list sidebar
  const botEntry = page.locator(`[data-tid="chat-list"] >> text="${botName}"`).first()
    .or(page.getByText(botName, { exact: true }).first());
  await botEntry.click();
  await page.waitForTimeout(2_000);
}

/**
 * Send a message in the current Teams chat.
 * Appends a UUID nonce to make the message unique for reply matching.
 *
 * @returns The full message text that was sent (including nonce)
 */
export async function sendMessage(
  page: Page,
  text: string
): Promise<string> {
  const nonce = randomUUID().slice(0, 8);
  const fullText = `${text} [${nonce}]`;
  await sendRawMessage(page, fullText);
  return fullText;
}

/**
 * Send a message without appending a nonce.
 * Use this when the bot handler requires an exact match (e.g., "card").
 */
export async function sendRawMessage(
  page: Page,
  text: string
): Promise<void> {
  const composeBox = page.getByPlaceholder("Type a message").first();
  await composeBox.click();
  await page.keyboard.type(text, { delay: 50 });
  await page.keyboard.press("Enter");
}

/**
 * Wait for the bot to reply with a message containing the expected text.
 * Looks for messages in the chat that contain the nonce from the sent message.
 *
 * @param sentText - The full text that was sent (including nonce), used to extract the nonce
 * @param timeout - How long to wait for the reply (default: 15s)
 * @returns The text content of the bot's reply
 */
export async function waitForBotReply(
  page: Page,
  sentText: string,
  timeout = 15_000
): Promise<string> {
  // Extract the nonce from the sent message
  const nonceMatch = sentText.match(/\[([a-f0-9]+)\]/);
  if (!nonceMatch) {
    throw new Error(
      `Could not extract nonce from sent message: "${sentText}"`
    );
  }
  const nonce = nonceMatch[1];

  // Wait for a message that contains the nonce but is NOT our sent message.
  // Bot echo replies contain the original text. We use a broad text search
  // since Teams message container selectors change across versions.
  // The bot reply format is typically "user said: <text>" or "Echo: <text>".
  const replyLocator = page
    .getByText(new RegExp(`(echo|said).*${nonce}|${nonce}.*(echo|said)`, "i"))
    .first();

  await expect(replyLocator).toBeVisible({ timeout });

  const replyText = await replyLocator.innerText();
  return replyText;
}
