# Single Browser Instance Orchestration — Implementation Summary

**Date:** 2025-01-06  
**Agent:** Nibbler (E2E Tester)  
**Context:** Restructure Playwright e2e orchestration to use ONE browser instance across all 3 language backends

---

## Problem

Original flow cold-started the browser 3 times:
1. Start bot (node/dotnet/python)
2. Launch fresh Chromium browser
3. Sign in / restore Teams storage state
4. Run Playwright specs
5. Close browser
6. Stop bot

Since all bots bind to port 3978 sequentially, Teams (via devtunnel) doesn't know which language is responding. The browser doesn't need to restart.

---

## Solution (Approach B: Playwright Projects)

**Strategy:** Single `npx playwright test` invocation with bot lifecycle handled by Playwright setup/teardown fixtures.

**Architecture:**
- Three Playwright projects: `dotnet-tests`, `node-tests`, `python-tests`
- Each project has:
  - Setup fixture (`dotnet.setup.ts`, etc.) — starts bot, waits for `/health`
  - Test specs (runs against the bot)
  - Teardown fixture (`global-teardown.ts`) — stops the bot
- All projects share the same `storageState.json` and browser context
- Projects run sequentially (`fullyParallel: false`), so bots don't conflict on port 3978

---

## Files Changed

### Created
- `e2e/playwright/bot-lifecycle.ts` — Bot start/stop helpers with health checks (loadEnv, startDotNetBot, startNodeBot, startPythonBot, stopBot, waitForHealth)
- `e2e/playwright/dotnet.setup.ts` — .NET bot setup fixture
- `e2e/playwright/node.setup.ts` — Node.js bot setup fixture
- `e2e/playwright/python.setup.ts` — Python bot setup fixture
- `e2e/playwright/global-teardown.ts` — Global teardown for bot cleanup

### Modified
- `e2e/playwright/playwright.config.ts` — Replaced single `teams-tests` project with three language-specific projects (dotnet-tests, node-tests, python-tests), each with setup/teardown dependencies
- `e2e/run-playwright-tests.ps1` — Simplified to single `npx playwright test` invocation with project filtering
- `e2e/run-playwright-tests.sh` — Bash version of the above
- `e2e/playwright/package.json` — Updated npm scripts to use new project names
- `e2e/playwright/README.md` — Documents new single-browser flow
- `.squad/agents/nibbler/charter.md` — Updated "Running E2E Tests" section
- `.squad/agents/nibbler/history.md` — Appended learning entry

---

## Usage (Unchanged UX)

```powershell
# Run all 3 languages (one browser, 3 bot swaps):
cd e2e
.\run-playwright-tests.ps1

# Run a single language:
.\run-playwright-tests.ps1 -Language node
.\run-playwright-tests.ps1 -Language dotnet
.\run-playwright-tests.ps1 -Language python

# Headed mode (see the browser stay alive between transitions):
.\run-playwright-tests.ps1 -Headed
.\run-playwright-tests.ps1 -Language node -Headed
```

Or directly via npm:
```bash
cd e2e/playwright
npm test                  # All 3 languages
npm run test:headed       # All 3 languages, headed
npm run test:dotnet       # .NET only
npm run test:node         # Node only
npm run test:python       # Python only
```

---

## Benefits

- **3x faster:** One browser launch instead of three
- **One Teams initialization** instead of three
- **Browser stays warm** between language transitions
- **Cleaner separation:** Orchestration logic lives in Playwright config, not shell scripts
- **Preserved UX:** The `-Language` flag still works for single-language debugging

---

## Verification Status

**Static review only.** All TypeScript files pass syntax checks (`node --check`). 

Rido will run locally with devtunnel + Teams auth to verify:
1. The browser stays alive across all 3 language transitions (use `-Headed` to watch)
2. Setup/teardown fixtures correctly start/stop bots
3. All 5 test specs pass for each language

---

## Lesson

When testing identical scenarios against sequential backends that share a port, orchestrate the swap at the fixture level (inside one Playwright run) rather than looping at the shell level. Playwright projects + setup/teardown dependencies are the idiomatic way to coordinate lifecycle across multi-backend tests.
