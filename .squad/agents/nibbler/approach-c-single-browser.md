# Single-Browser E2E Architecture (Approach C)

**Date:** 2025-01-06  
**Agent:** Nibbler (E2E Tester)  
**Issue Context:** Rido reported "I still see many browser instances" after Approach B implementation

## Problem Statement

Approach B (Playwright projects with setup/teardown) **did not achieve single-browser reuse**. Despite using shared `storageState.json` and sequential execution, Playwright was still spawning multiple Chromium processes — one per project.

## Root Cause

**Playwright projects are execution boundaries, not browser-sharing primitives.** Each project with browser context settings (e.g., `use: { channel: "msedge" }`) spawns its own browser workers, even when running sequentially and sharing storage state. The project-with-dependencies pattern is designed for test isolation, NOT browser reuse.

## Solution: Single Project with Parameterized Describes

### Architecture

**ONE Playwright project (`teams-tests`)** runs all tests with bot lifecycle managed inside test fixtures:

```typescript
// tests/cross-language.spec.ts
const enabledLanguages = process.env.E2E_LANGUAGES.split(','); // 'dotnet,node,python'

for (const lang of enabledLanguages) {
  test.describe(`${lang.toUpperCase()} bot`, () => {
    test.beforeAll(async () => {
      await startBot[lang]();  // Start bot on port 3978
    });

    test.afterAll(async () => {
      await stopBot();  // Stop bot
    });

    test("echo bot replies", async ({ page }) => { ... });
    test("counter increments", async ({ page }) => { ... });
    // ... all test scenarios
  });
}
```

### How It Works

1. Playwright launches **ONE** browser instance for the `teams-tests` project
2. Test suite loops over `enabledLanguages` (derived from `E2E_LANGUAGES` env var)
3. Each language gets a `describe` block with its own `beforeAll` (start bot) and `afterAll` (stop bot)
4. All tests run sequentially in the same browser session
5. Only the bot on port 3978 swaps between describe blocks — browser stays alive

### CLI Surface (Preserved)

```powershell
# Run all 3 languages, one browser:
.\run-playwright-tests.ps1

# Run single language, one browser:
.\run-playwright-tests.ps1 -Language node
.\run-playwright-tests.ps1 -Language dotnet
.\run-playwright-tests.ps1 -Language python

# Headed mode (see browser persist across language transitions):
.\run-playwright-tests.ps1 -Headed
```

The orchestrator sets `$env:E2E_LANGUAGES='dotnet,node,python'` (or filters to one language), then invokes:

```powershell
npx playwright test --project=teams-tests tests/cross-language.spec.ts
```

## Changes Made

### Files Deleted (from Approach B)
- `e2e/playwright/dotnet.setup.ts`
- `e2e/playwright/node.setup.ts`
- `e2e/playwright/python.setup.ts`
- `e2e/playwright/global-teardown.ts`

These were the wrong abstraction — setup/teardown projects spawn separate browsers.

### Files Created
- `e2e/playwright/tests/cross-language.spec.ts` — New parameterized test suite

### Files Changed
- `e2e/playwright/playwright.config.ts` — Reduced from 9 projects to 2 (auth-setup + teams-tests)
- `e2e/run-playwright-tests.ps1` — Sets `E2E_LANGUAGES` env var instead of project filters
- `e2e/playwright/README.md` — Updated to reflect single-project architecture
- `.squad/agents/nibbler/history.md` — Documents why Approach B failed and what Approach C achieves

### Files Kept
- `e2e/playwright/bot-lifecycle.ts` — Still provides start/stop helpers, now called from test hooks

## Verification

### Static Verification (Confirmed)

```powershell
# List tests for Node.js only:
$env:E2E_LANGUAGES='node'
npx playwright test --list --project=teams-tests tests/cross-language.spec.ts
# Output: 6 tests (1 auth-setup + 5 NODE bot tests in teams-tests project)

# List tests for all 3 languages:
$env:E2E_LANGUAGES='dotnet,node,python'
npx playwright test --list --project=teams-tests tests/cross-language.spec.ts
# Output: 16 tests (1 auth-setup + 15 language tests: 5 DOTNET + 5 NODE + 5 PYTHON)
```

**Key Observation:** Only ONE `teams-tests` project with `use: { channel: "msedge" }` in the config → only ONE browser spawns.

### Runtime Verification (Pending)

**Cannot verify end-to-end without Teams auth setup.** However, static analysis confirms:
- The config has only 2 projects: `auth-setup` (interactive login, not run during normal tests) and `teams-tests` (actual test execution)
- Only `teams-tests` has `use: { channel: "msedge", storageState: "storageState.json" }` → only ONE browser process
- The test suite correctly parameterizes over languages and starts/stops bots in hooks

**To verify at runtime (for Rido):**
1. Run `cd e2e && .\run-playwright-tests.ps1 -Headed` (need Teams auth + devtunnel)
2. Observe via Task Manager or `Get-Process | Where-Object { $_.ProcessName -match 'msedge|chrome' }` that only ONE browser process exists
3. Watch the bot swap (dotnet → node → python) while the browser stays open

## Why Approach B Failed

**Playwright's default behavior:**
- Each project with `use: { channel: ... }` spawns its own browser context
- Browser contexts often run in separate browser processes (especially across workers)
- Project setup/teardown runs in its own test execution phase with its own browser workers
- Even with `dependencies: ["dotnet-setup"]`, the setup project spawns a browser to run its test file, then the dependent project spawns another browser for its tests

**The project-with-dependencies pattern is designed for:**
- Authentication flows that need to run before tests (each spawns its own browser)
- Test isolation between different test suites (deliberately separate browsers)
- Sequential execution to prevent conflicts (e.g., shared DB, shared port)

**It is NOT designed for:**
- Reusing the same browser across multiple test phases
- Hot-swapping backend dependencies while keeping the frontend (browser) alive

## Why Approach C Works

**Single project = single browser.** By moving bot lifecycle into test hooks (`beforeAll`/`afterAll`) within ONE project, we get:
- ONE browser launch (for the `teams-tests` project)
- Bot start/stop happens inside the test execution phase (not in separate setup projects)
- The browser stays alive for the entire test run; only the bot on port 3978 changes

This is the Playwright-idiomatic way to handle sequential backend swaps with a persistent frontend.

## Key Lesson

**Playwright projects are NOT a browser-sharing primitive.** Use projects for test isolation (separate concerns, separate browsers). Use parameterized test blocks (describe loops) within a single project when you want to reuse ONE browser across multiple test phases with different backend dependencies.

**Correct pattern for single-browser, multi-backend testing:**
- ONE Playwright project
- Parameterized describe blocks (loop over backends)
- Backend lifecycle in `beforeAll`/`afterAll` hooks (NOT setup/teardown projects)
- Frontend (browser) lifecycle managed by Playwright (one browser per project)

## Next Steps

Rido will verify the single-browser behavior with a full run including Teams auth. If confirmed, this pattern is the reference implementation for multi-backend E2E testing with shared frontend state.
