/**
 * Interactive authentication setup for Teams web.
 *
 * Run with:  npm run setup
 *
 * This opens a headed Edge browser, navigates to Teams, and waits for you to
 * complete the login flow (including MFA). Once Teams loads, it saves the
 * browser session to storageState.json for headless test reuse.
 */
import { test as setup } from "@playwright/test";
import path from "path";
import fs from "fs";

const storageStatePath = path.resolve(__dirname, "storageState.json");

setup("authenticate with Teams", async ({ page }) => {
  // If we already have a valid session, skip re-authentication
  if (fs.existsSync(storageStatePath)) {
    const stats = fs.statSync(storageStatePath);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageHours < 12) {
      console.log(
        `storageState.json is ${ageHours.toFixed(1)}h old — reusing. Delete it to force re-auth.`
      );
      return;
    }
    console.log(
      `storageState.json is ${ageHours.toFixed(1)}h old — re-authenticating.`
    );
  }

  console.log(
    "\n👉 Complete the Teams login (including MFA) in the browser window.\n" +
      "   The test will continue automatically once Teams fully loads.\n"
  );

  await page.goto("https://teams.microsoft.com/");

  // Wait for a Teams-specific UI element that only appears after successful login.
  // Use .or() to combine multiple locator strategies for resilience.
  const teamsLoaded = page
    .getByPlaceholder("Type a message")
    .or(page.getByPlaceholder("Type a new message"))
    .or(page.getByRole("button", { name: "Chat" }))
    .or(page.getByRole("button", { name: "Activity" }))
    .first();
  await teamsLoaded.waitFor({ state: "visible", timeout: 180_000 });

  // Give the SPA a moment to finish settling after the shell appears
  await page.waitForTimeout(3_000);

  // Save the authenticated session
  await page.context().storageState({ path: storageStatePath });
  console.log(`\n✅ Session saved to ${storageStatePath}\n`);
});
