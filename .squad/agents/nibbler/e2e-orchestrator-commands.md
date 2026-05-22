# E2E Orchestrator Command Reference

## New Flow Summary

**Before:** `run-playwright-tests.ps1` looped 3 times, starting bot → launching browser → running tests → closing browser → stopping bot for each language.

**After:** Single `npx playwright test` invocation with bot lifecycle handled by Playwright setup/teardown fixtures. Browser stays warm across all 3 language runs.

---

## Commands (UX unchanged)

### Run all 3 languages
```powershell
cd e2e
.\run-playwright-tests.ps1
```

### Run single language
```powershell
.\run-playwright-tests.ps1 -Language node
.\run-playwright-tests.ps1 -Language dotnet
.\run-playwright-tests.ps1 -Language python
```

### Headed mode (watch browser stay alive between languages)
```powershell
.\run-playwright-tests.ps1 -Headed
.\run-playwright-tests.ps1 -Language node -Headed
```

### Direct npm commands (from e2e/playwright/)
```bash
npm test                  # All 3 languages
npm run test:headed       # All 3 languages, headed
npm run test:dotnet       # .NET only
npm run test:node         # Node only
npm run test:python       # Python only
```

---

## What Changed Internally

### Old PowerShell Script Flow
```powershell
foreach language in [dotnet, node, python]:
  1. Start bot
  2. Wait for /health
  3. npx playwright test --project=teams-tests  # New browser each time
  4. Stop bot
```

### New PowerShell Script Flow
```powershell
# Single invocation:
npx playwright test --project=dotnet-tests --project=node-tests --project=python-tests

# Playwright internally handles:
#   dotnet-setup → start .NET bot
#   dotnet-tests → run specs
#   dotnet-teardown → stop .NET bot
#   node-setup → start Node bot
#   node-tests → run specs
#   node-teardown → stop Node bot
#   python-setup → start Python bot
#   python-tests → run specs
#   python-teardown → stop Python bot
# All with the SAME browser instance
```

---

## Playwright Config Changes

### Old (playwright.config.ts)
- Single project: `teams-tests` (matches all test specs)
- Bot lifecycle handled externally by PowerShell script
- 3 browser cold-starts

### New (playwright.config.ts)
- Three test projects: `dotnet-tests`, `node-tests`, `python-tests`
- Each project has setup/teardown dependencies:
  - `dotnet-setup` → `dotnet-tests` → `dotnet-teardown`
  - `node-setup` → `node-tests` → `node-teardown`
  - `python-setup` → `python-tests` → `python-teardown`
- All projects share `storageState.json` (browser context reused)
- Projects run sequentially (`fullyParallel: false`)
- Bot lifecycle handled internally by Playwright fixtures
- 1 browser launch (stays warm across all projects)

---

## File Locations

| File | Purpose |
|------|---------|
| `e2e/playwright/bot-lifecycle.ts` | Bot start/stop helpers with health checks |
| `e2e/playwright/dotnet.setup.ts` | .NET bot setup fixture |
| `e2e/playwright/node.setup.ts` | Node.js bot setup fixture |
| `e2e/playwright/python.setup.ts` | Python bot setup fixture |
| `e2e/playwright/global-teardown.ts` | Global teardown (stops bot after all tests) |
| `e2e/playwright/playwright.config.ts` | Playwright configuration with 3 language projects |
| `e2e/run-playwright-tests.ps1` | Orchestrator script (Windows) |
| `e2e/run-playwright-tests.sh` | Orchestrator script (Linux/Mac) |

---

## Troubleshooting

| Symptom | Solution |
|---------|----------|
| "Bot failed to start" | Check that port 3978 is not already in use |
| "storageState.json not found" | Run `cd e2e/playwright && npm run setup` first |
| Tests pass individually but fail together | Verify `fullyParallel: false` in config |
| Browser still launches 3 times | Verify you're using the new orchestrator script (check git status) |
| Setup fixture times out | Increase `HEALTH_TIMEOUT_MS` in bot-lifecycle.ts (default: 30s) |

---

## Verification Checklist

1. ✅ Syntax checks pass (`node --check` on all TS files)
2. ⏳ Run locally with `-Headed` and watch browser stay alive
3. ⏳ Verify all 5 test specs pass for each language
4. ⏳ Verify single-language runs still work (`-Language node`)
5. ⏳ Verify bot processes terminate cleanly after tests
