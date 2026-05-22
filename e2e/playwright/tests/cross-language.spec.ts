/**
 * Cross-language E2E tests for bot implementations.
 * This file runs the same test suite against .NET, Node, and Python bots
 * within a SINGLE browser session AND a SINGLE shared page (context) per language —
 * reusing both browser and tab across all tests to avoid Teams reload overhead.
 *
 * Bots are started/stopped in beforeAll/afterAll hooks for each language.
 */
import { test, expect, type Page } from "@playwright/test";
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
const STORAGE_STATE = "storageState.json";

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

  // Force serial mode so the shared page below is safe across tests in the suite.
  test.describe.configure({ mode: "serial" });

  test.describe(`${lang.toUpperCase()} bot`, () => {
    // Single page shared across all tests in this describe block — avoids reloading
    // Teams and re-navigating to the bot chat for every test.
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
      loadEnv();
      console.log(`Starting ${lang} bot...`);
      await botStarters[lang as Language]();

      // Create one context + page for the entire suite
      const context = await browser.newContext({ storageState: STORAGE_STATE });
      sharedPage = await context.newPage();
      await ensureTeamsLoaded(sharedPage);
      await navigateToBotChat(sharedPage, BOT_NAME);
    });

    test.afterAll(async () => {
      if (sharedPage) {
        await sharedPage.context().close();
      }
      console.log(`Stopping ${lang} bot...`);
      await stopBot();
    });

    test.beforeEach(async () => {
      assertStorageStateValid();
    });

    test("echo bot replies with the sent message", async () => {
      const sentText = await sendMessage(sharedPage, "hello from playwright");
      const replyText = await waitForBotReply(sharedPage, sentText);

      expect(replyText.toLowerCase()).toContain("hello from playwright");
      const nonceMatch = sentText.match(/\[([a-f0-9]+)\]/);
      expect(replyText).toContain(nonceMatch![1]);
    });

    test("counter bot increments on each message", async () => {
      // Reset state first to ensure a clean baseline — the bot uses MemoryStorage
      // that persists across tests within the same bot process.
      await sendRawMessage(sharedPage, "reset");
      await waitForBotReplyMatching(sharedPage, /Counter reset/i);

      // Send first "counter" command. Match the SPECIFIC expected value
      // because waitForBotReplyMatching uses .last() and earlier "Count: N"
      // messages in chat history would otherwise win the race.
      await sendRawMessage(sharedPage, "counter");
      const firstReply = await waitForBotReplyMatching(sharedPage, /^Count: 1$/);
      expect(firstReply).toMatch(/Count: 1/);

      // Send second "counter" command
      await sendRawMessage(sharedPage, "counter");
      const secondReply = await waitForBotReplyMatching(sharedPage, /^Count: 2$/);
      expect(secondReply).toMatch(/Count: 2/);

      // Reset the counter
      await sendRawMessage(sharedPage, "reset");
      const resetReply = await waitForBotReplyMatching(sharedPage, /Counter reset/i);
      expect(resetReply).toMatch(/Counter reset/i);

      // Verify counter resets to 1
      await sendRawMessage(sharedPage, "counter");
      const afterResetReply = await waitForBotReplyMatching(sharedPage, /^Count: 1$/);
      expect(afterResetReply).toMatch(/Count: 1/);
    });

    test("mention bot responds to @mentions", async () => {
      // The test-bots check text.startsWith('mention') (case-insensitive)
      await sendRawMessage(sharedPage, "mention hello");
      const replyText = await waitForBotReplyMatching(sharedPage, /said:/i);

      // Bot echoes with "@<user> said: mention hello"
      expect(replyText.toLowerCase()).toContain("said:");
      expect(replyText.toLowerCase()).toContain("mention");
    });

    test("submit action card returns correct response", async () => {
      // Send raw "card" command to trigger the Adaptive Card
      await sendRawMessage(sharedPage, "card");

      // Wait for the Adaptive Card to appear by looking for the Submit button.
      // Scope to .last() since Teams chat history may show "Submit" from prior runs.
      const submitButton = sharedPage.getByRole("button", { name: "Submit" }).or(
        sharedPage.getByText("Submit")
      ).last();
      await expect(submitButton).toBeVisible({ timeout: 15_000 });

      // Click Submit — fires an adaptiveCard/action invoke.
      // The bot responds with a new card containing "✅ Invoke received!".
      await submitButton.click();

      // Verify the bot's invoke response card replaces/updates with the expected text.
      const invokeResponse = sharedPage.getByText(/Invoke received/i).last();
      await expect(invokeResponse).toBeVisible({ timeout: 15_000 });
    });

    test("invoke activity receives correct payload", async () => {
      const sentText = await sendMessage(sharedPage, "invoke");
      const replyText = await waitForBotReply(sharedPage, sentText);

      expect(replyText.toLowerCase()).toContain("invoke");
    });
  });
}
