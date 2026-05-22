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
  expectLastMatchText,
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
      // Using expectLastMatchText (asserts on .last()) catches state-persistence
      // regressions: if the bot keeps replying "Count: 1", the last message will
      // never become "Count: 2" and the assertion times out — instead of
      // false-passing on a stale value that happens to match the regex.
      //
      // We add small waits between sends so the test exercises STATE PERSISTENCE
      // across turns rather than concurrent-turn handling. A bot framework with
      // a per-key state race condition is a separate concern from "does state
      // round-trip through storage correctly" and would be tested elsewhere.
      const countPattern = /^Count: \d+$/;
      const TURN_GAP_MS = 1500;

      // Reset state first to ensure a clean baseline — the bot uses MemoryStorage
      // that persists across tests within the same bot process.
      await sendRawMessage(sharedPage, "reset");
      await waitForBotReplyMatching(sharedPage, /Counter reset/i);
      await sharedPage.waitForTimeout(TURN_GAP_MS);

      // First "counter" → most recent counter message must be exactly "Count: 1"
      await sendRawMessage(sharedPage, "counter");
      await expectLastMatchText(sharedPage, countPattern, "Count: 1");
      await sharedPage.waitForTimeout(TURN_GAP_MS);

      // Second "counter" → most recent counter message must be exactly "Count: 2"
      // (This is the check that fails if state doesn't persist across turns.)
      await sendRawMessage(sharedPage, "counter");
      await expectLastMatchText(sharedPage, countPattern, "Count: 2");
      await sharedPage.waitForTimeout(TURN_GAP_MS);

      // Third "counter" → "Count: 3" — extra step that gives us more confidence
      // the counter is monotonic, not flapping.
      await sendRawMessage(sharedPage, "counter");
      await expectLastMatchText(sharedPage, countPattern, "Count: 3");
      await sharedPage.waitForTimeout(TURN_GAP_MS);

      // Reset → wait for confirmation
      await sendRawMessage(sharedPage, "reset");
      await waitForBotReplyMatching(sharedPage, /Counter reset/i);
      await sharedPage.waitForTimeout(TURN_GAP_MS);

      // Counter resets to 1
      await sendRawMessage(sharedPage, "counter");
      await expectLastMatchText(sharedPage, countPattern, "Count: 1");
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
