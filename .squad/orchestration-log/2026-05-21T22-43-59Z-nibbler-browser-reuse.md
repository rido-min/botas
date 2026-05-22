# Nibbler — E2E Browser Reuse Orchestration

**Agent:** Nibbler (claude-sonnet-4.5, background)  
**Timestamp:** 2026-05-21T22:43:59Z  
**Status:** ✅ Complete

## Summary

Refactored the Playwright e2e orchestrator to eliminate cold-start overhead by reusing a single Chromium browser instance across all three language runs.

## Problem

Previously, `run-playwright-tests.ps1` spawned three separate `npx playwright test` invocations:
- Each invocation cold-started Chromium
- Each re-initialized the Teams session via bot setup
- Wasted browser startup time on each language transition

## Solution (Approach B)

Implemented Playwright projects with per-project setup/teardown fixtures:
1. **One** `npx playwright test` invocation  
2. **Three projects** (dotnet-tests, node-tests, python-tests) run sequentially  
3. Each project's setup: start bot → wait for /health  
4. Each project's teardown: stop bot  
5. Browser instance lives for entire test run  

## Files Modified/Created

**New files:**
- `e2e/playwright/bot-lifecycle.ts` — Bot server control (start/stop/health)
- `e2e/playwright/dotnet.setup.ts` — .NET bot setup fixture
- `e2e/playwright/node.setup.ts` — Node.js bot setup fixture
- `e2e/playwright/python.setup.ts` — Python bot setup fixture
- `e2e/playwright/global-teardown.ts` — Global browser cleanup

**Updated files:**
- `e2e/playwright/playwright.config.ts` — Project definitions, setup/teardown hooks
- `e2e/playwright/package.json` — Dependencies
- `e2e/playwright/README.md` — Usage docs
- `e2e/run-playwright-tests.ps1` — CLI preserved
- `e2e/run-playwright-tests.sh` — CLI preserved

## Verification

- Static check: `node --check` clean on all TypeScript files
- Rido will smoke-test with `-Headed` locally

## CLI Compatibility

User interface **unchanged**:
- `.\run-playwright-tests.ps1` → all 3 languages
- `.\run-playwright-tests.ps1 -Language X` → single language
- Both support `-Headed` flag

## Library Impact

**None** — e2e tooling only. No impact on botas library code, samples, or tests.

## Reported By

rido

## Notes

Nibbler left optional reference documents:
- `.squad/agents/nibbler/single-browser-orchestration-summary.md`
- `.squad/agents/nibbler/e2e-orchestrator-commands.md`

These are informational; treated as non-essential squad artifacts.
