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
  waitForBotReply,
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

      // Send first message
      const firstSent = await sendMessage(page, "count");
      const firstReply = await waitForBotReply(page, firstSent);
      expect(firstReply).toMatch(/count.*?1/i);

      // Send second message
      const secondSent = await sendMessage(page, "count again");
      const secondReply = await waitForBotReply(page, secondSent);
      expect(secondReply).toMatch(/count.*?2/i);
    });

    test("mention bot responds to @mentions", async ({ page }) => {
      await ensureTeamsLoaded(page);
      await navigateToBotChat(page, BOT_NAME);

      const sentText = await sendMessage(page, "@EchoBot hello");
      const replyText = await waitForBotReply(page, sentText);

      expect(replyText.toLowerCase()).toContain("mention");
    });

    test("submit action card returns correct response", async ({ page }) => {
      await ensureTeamsLoaded(page);
      await navigateToBotChat(page, BOT_NAME);

      const sentText = await sendMessage(page, "card");
      const replyText = await waitForBotReply(page, sentText);

      expect(replyText.toLowerCase()).toContain("submit");
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
