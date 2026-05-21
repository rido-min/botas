# Playwright E2E Tests for Teams Bots

Prototype E2E tests that drive the **Teams web client** with Playwright to verify bot behavior end-to-end.

## Prerequisites

1. **Node.js** 18+ installed
2. A **Teams bot** registered and sideloaded in your test tenant (see [Setup Guide](../../docs-site/setup.md))
3. The bot **running** and reachable from Teams (via devtunnel or deployed endpoint)
4. A **test user account** in the tenant where the bot is installed

## Quick Start

```bash
cd e2e/playwright

# Install dependencies + Playwright browsers
npm install
npx playwright install msedge

# Copy and fill in env vars
cp .env.example .env
# Edit .env: set TEAMS_BOT_NAME to your bot's display name

# Step 1: Authenticate (interactive — complete MFA in the browser)
npm run setup

# Step 2: Run tests (headless, uses saved session)
npm test

# Or run tests headed (useful for debugging)
npm run test:headed
```

## How It Works

### Authentication

Since MFA cannot be disabled, authentication is **semi-automated**:

1. `npm run setup` opens an Edge browser and navigates to `teams.microsoft.com`
2. You complete the login flow manually (email, password, MFA)
3. Once Teams loads, Playwright saves the browser session to `storageState.json`
4. Subsequent test runs load this saved session — no login needed

The session typically lasts 12-24 hours. When it expires, tests will fail with a clear message telling you to re-run `npm run setup`.

### Test Structure

- `auth.setup.ts` — Interactive login flow (run separately via `npm run setup`)
- `teams-helpers.ts` — Reusable helpers (navigate to bot chat, send messages, wait for replies)
- `tests/echo-bot.spec.ts` — Prototype test: sends a message, verifies the echo reply
- `tests/invoke-bot.spec.ts` — Sends "card", clicks Adaptive Card button, verifies invoke response
- `tests/counter-bot.spec.ts` — Tests stateful counter behavior
- `tests/submit-bot.spec.ts` — Tests Action.Submit button behavior
- `tests/mention-bot.spec.ts` — Tests @mention handling

### Bot Samples

The Playwright tests require the **test-bot** sample (not the echo bot). The test-bot includes:
- Echo handler (message reply)
- `card` command (sends Adaptive Card with Action.Execute button)
- `adaptiveCard/action` invoke handler (returns updated card)
- `test/echo` invoke handler (echoes the activity value)
- Counter state management (TurnState)
- Action.Submit handling

Start the test-bot in the language you want to test:

```bash
# .NET
cd dotnet/samples/TestBot && dotnet run

# Node.js
cd node/samples/test-bot && npx tsx index.ts

# Python
cd python/samples/test-bot && python main.py
```

### Multi-Language Testing with Single Browser Instance

The new orchestration runs all 3 language bots sequentially **with a single browser instance** for efficiency. The browser stays warm across all language transitions, eliminating cold-start overhead.

**How it works:**
- Each language has its own Playwright project (`dotnet-tests`, `node-tests`, `python-tests`)
- Each project has a setup fixture that starts the bot and waits for `/health`
- Each project has a teardown fixture that stops the bot
- All projects share the same `storageState.json` and browser context
- Projects run sequentially (fullyParallel: false), so bots don't conflict on port 3978

**Use the orchestrator script** (`e2e/run-playwright-tests.ps1` or `e2e/run-playwright-tests.sh`):

```powershell
# Run all 3 languages (one browser instance, 3 bot swaps):
cd e2e
.\run-playwright-tests.ps1

# Run a single language:
.\run-playwright-tests.ps1 -Language node
.\run-playwright-tests.ps1 -Language dotnet
.\run-playwright-tests.ps1 -Language python

# Headed mode (see the browser stay alive between language transitions):
.\run-playwright-tests.ps1 -Headed
.\run-playwright-tests.ps1 -Language node -Headed
```

**What the new flow does:**
1. Loads `.env` from repo root into the bot lifecycle fixtures
2. Playwright starts all selected projects (`dotnet-tests`, `node-tests`, `python-tests`)
3. For each project:
   - Setup fixture starts the bot and waits for `/health` (30s timeout)
   - Test specs run against the bot (browser reuses existing context)
   - Teardown fixture stops the bot
4. Browser closes once after all projects complete

### Message Uniqueness

Each test sends messages with a UUID nonce (e.g., `hello from playwright [a1b2c3d4]`) to avoid matching stale messages from previous runs.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "storageState.json not found" | Run `npm run setup` first |
| "Session expired" | Delete `storageState.json` and re-run `npm run setup` |
| Tests fail to find the compose box | Teams UI may have changed — update selectors in `teams-helpers.ts` |
| Bot doesn't reply | Verify the bot is running and the devtunnel is active |
| Edge not found | Run `npx playwright install msedge` |
| Bot fails to start | Check that port 3978 is not already in use |

## Selector Maintenance

Teams uses `data-tid` attributes which are more stable than CSS classes, but they are **not a public API** and can change when Teams updates. All selectors are centralized in `teams-helpers.ts` for easy maintenance.

## Known Limitations

- **Not CI-ready**: Requires interactive MFA login, so this is a local/manual test tool
- **Fragile selectors**: Teams web UI can change without notice
- **Slow**: UI tests take 10-30 seconds each
- **Single bot**: Currently tests against the test-bot sample
