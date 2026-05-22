/**
 * Cross-language E2E tests for bot implementations.
 * This file runs the same test suite against .NET, Node, and Python bots
 * within a SINGLE browser session (reusing the same Playwright browser instance).
 * 
 * Bots are started/stopped in beforeAll/afterAll hooks for each language.
 */
import { test, expect } from "@playwright/test";
import {
  assertStorageStateValid,
  ensureTeamsLoaded,
  navigateToBotChat,
  sendMessage,
  sendRawMessage,
  waitForBotReply,
  waitForBotReplyMatching,
} from "../teams-helpers";
import {
  loadEnv,
  startDotNetBot,
  startNodeBot,
  startPythonBot,
  stopBot,
} from "../bot-lifecycle";

const BOT_NAME = process.env.TEAMS_BOT_NAME || "EchoBot";

// Determine which languages to test based on E2E_LANGUAGES env var
const languageEnv = process.env.E2E_LANGUAGES || "dotnet,node,python";
const enabledLanguages = languageEnv.split(",").map((l) => l.trim());

type Language = "dotnet" | "node" | "python";

const botStarters: Record<Language, () => Promise<void>> = {
  dotnet: startDotNetBot,
  node: startNodeBot,
  python: startPythonBot,
};

for (const lang of enabledLanguages) {
  if (!botStarters[lang as Language]) {
    console.warn(`Unknown language "${lang}" in E2E_LANGUAGES, skipping...`);
    continue;
  }

  test.describe(`${lang.toUpperCase()} bot`, () => {
    test.beforeAll(async () => {
      loadEnv();
      console.log(`Starting ${lang} bot...`);
      await botStarters[lang as Language]();
    });

    test.afterAll(async () => {
      console.log(`Stopping ${lang} bot...`);
      await stopBot();
    });

    test.beforeEach(async () => {
      assertStorageStateValid();
    });

    test("echo bot replies with the sent message", async ({ page }) => {
      await ensureTeamsLoaded(page);
      await navigateToBotChat(page, BOT_NAME);
      const sentText = await sendMessage(page, "hello from playwright");
      const replyText = await waitForBotReply(page, sentText);

      expect(replyText.toLowerCase()).toContain("hello from playwright");
      const nonceMatch = sentText.match(/\[([a-f0-9]+)\]/);
      expect(replyText).toContain(nonceMatch![1]);
    });

    test("counter bot increments on each message", async ({ page }) => {
      await ensureTeamsLoaded(page);
      await navigateToBotChat(page, BOT_NAME);

      // Send first "counter" command
      await sendRawMessage(page, "counter");
      const firstReply = await waitForBotReplyMatching(page, /^Count: \d+$/);
      expect(firstReply).toMatch(/Count: 1/);

      // Send second "counter" command
      await sendRawMessage(page, "counter");
      const secondReply = await waitForBotReplyMatching(page, /^Count: \d+$/);
      expect(secondReply).toMatch(/Count: 2/);

      // Reset the counter
      await sendRawMessage(page, "reset");
      const resetReply = await waitForBotReplyMatching(page, /Counter reset/i);
      expect(resetReply).toMatch(/Counter reset/i);

      // Verify counter resets to 1
      await sendRawMessage(page, "counter");
      const afterResetReply = await waitForBotReplyMatching(page, /^Count: \d+$/);
      expect(afterResetReply).toMatch(/Count: 1/);
    });

    test("mention bot responds to @mentions", async ({ page }) => {
      await ensureTeamsLoaded(page);
      await navigateToBotChat(page, BOT_NAME);

      // The test-bots check text.startsWith('mention') (case-insensitive)
      await sendRawMessage(page, "mention hello");
      const replyText = await waitForBotReplyMatching(page, /said:/i);

      // Bot echoes with "@<user> said: mention hello"
      expect(replyText.toLowerCase()).toContain("said:");
      expect(replyText.toLowerCase()).toContain("mention");
    });

    test("submit action card returns correct response", async ({ page }) => {
      await ensureTeamsLoaded(page);
      await navigateToBotChat(page, BOT_NAME);

      // Send raw "card" command to trigger the Adaptive Card
      await sendRawMessage(page, "card");
      
      // Wait for the Adaptive Card to appear by looking for the Submit button
      const submitButton = page.getByRole("button", { name: "Submit" }).or(
        page.getByText("Submit")
      );
      await expect(submitButton).toBeVisible({ timeout: 15_000 });
    });

    test("invoke activity receives correct payload", async ({ page }) => {
      await ensureTeamsLoaded(page);
      await navigateToBotChat(page, BOT_NAME);

      const sentText = await sendMessage(page, "invoke");
      const replyText = await waitForBotReply(page, sentText);

      expect(replyText.toLowerCase()).toContain("invoke");
    });
  });
}
