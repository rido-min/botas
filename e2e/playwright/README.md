# Playwright E2E Tests for Teams Bots

Prototype E2E tests that drive the **Teams web client** with Playwright to verify bot behavior end-to-end.

## Prerequisites

1. **Node.js** 18+ installed
2. A **Teams bot** registered and sideloaded in your test tenant (see [specs/setup.md](../../specs/setup.md))
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

### Bot Samples

The Playwright tests require the **test-bot** sample (not the echo bot). The test-bot includes:
- Echo handler (message reply)
- `card` command (sends Adaptive Card with Action.Execute button)
- `adaptiveCard/action` invoke handler (returns updated card)
- `test/echo` invoke handler (echoes the activity value)

Start the test-bot in the language you want to test:

```bash
# .NET
cd dotnet/samples/TestBot && dotnet run

# Node.js
cd node/samples/test-bot && npx tsx index.ts

# Python
cd python/samples/test-bot && python main.py
```

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

## Selector Maintenance

Teams uses `data-tid` attributes which are more stable than CSS classes, but they are **not a public API** and can change when Teams updates. All selectors are centralized in `teams-helpers.ts` for easy maintenance.

## Known Limitations

- **Not CI-ready**: Requires interactive MFA login, so this is a local/manual test tool
- **Fragile selectors**: Teams web UI can change without notice
- **Slow**: UI tests take 10-30 seconds each
- **Single bot**: Currently tests against the test-bot sample
