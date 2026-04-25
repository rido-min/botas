---
outline: deep
---

# Getting Started

Let’s get your first Teams bot replying fast.

1. Be ready in ~5 seconds in any language.
2. Talk to your bot in Teams.
3. If you still need setup, use the [setup checklist](#step-3-setup-check-30-seconds) and [setup details](#setup-details-if-you-need-them).

::: tip
Yes, there’s a little setup first. Think of it as the “stretching before sprinting” part — less fun than chatting with your bot, but better than pulling a hamstring in production.
:::

---

## Step 1 — Ready in ~5 seconds (pick your language)

::: code-group

```csharp [.NET]
// Install:
// dotnet add package Botas

using Botas;

var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();

// Run:
// dotnet run --project dotnet/samples/EchoBot
```

::: info .NET uses `launchSettings.json`, not `.env`
.NET reads credentials from `launchSettings.json` in `AzureAd__` format (e.g., `AzureAd__ClientId`), not from `.env` files. Use the [`env-to-launch-settings.mjs` helper script](https://github.com/rido-min/botas/blob/main/dotnet/env-to-launch-settings.mjs) to convert `.env` to the correct format:

```bash
node dotnet/env-to-launch-settings.mjs EchoBot
```

See [Setup Guide → .NET Environment Variables](setup#net-environment-variables) for full details.
:::

```typescript [Node.js]
// Install:
// npm install botas-core botas-express

// botapp.ts
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()

// Run:
// npx tsx --env-file .env botapp.ts
```

```python [Python]
# Install:
# uv add botas botas-fastapi

# botapp.py
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()

# Run:
# uv run --env-file .env botapp.py
```
:::

---

## Step 2 — Talk to your bot

1. Open the `installLink` from the `teams app create` output.
2. Send a message in Teams.
3. Get an echo reply from your bot.
4. Missing `installLink`? Jump to [Step 3 setup](#step-3-setup-check-30-seconds).

---

## Step 3 — Setup check (30 seconds)

Make sure you have:

- ✅ **Teams tenant access** — you can sign into Microsoft Teams
- ✅ **Teams app created** — `teams app create` has run successfully or you've [sideloaded an app](https://learn.microsoft.com/microsoftteams/platform/concepts/deploy-and-publish/apps-upload)
- ✅ **Teams CLI installed** — `npm install -g @microsoft/teams.cli@preview`
- ✅ **Dev tunnel running** — exposing port `3978` to the internet
- ✅ **Bot credentials in `.env`** — `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` are set
- ✅ **Install link** — from `teams app create` output (needed to test in Teams)

If you're missing any of these, see the [Setup Guide](setup) for step-by-step instructions.

::: tip Quick credential setup
Create credentials + install link with Teams CLI:

```bash
teams app create --name "MyBot" --endpoint "https://<tunnel-url>/api/messages" --json
```

Save the returned credentials to a `.env` file at the repo root.
:::

---

## How a Teams message reaches your bot (comic flow)

![Comic-style infographic of Teams message flow from Teams client to Bot Service to Dev Tunnel to local bot and back.](/images/getting-started-flow-comic.svg)

---

## Setup details (if you need them)

For a complete setup walkthrough from zero, see the [Setup Guide](setup).

### Quick reference

**Teams CLI install**:
```bash
npm install -g @microsoft/teams.cli@preview
teams login
```

**Dev tunnel setup**:

```bash
# Install (if needed)
winget install Microsoft.devtunnel   # Windows
brew install --cask devtunnel        # macOS

# Create + host tunnel

devtunnel user login
devtunnel create --allow-anonymous
devtunnel port create -p 3978
devtunnel host
```

Use the HTTPS URL in your bot endpoint.

### More help

- **Full setup guide**: [Setup Guide](setup) — detailed walkthrough with troubleshooting
- **Authentication deep dive**: [How Authentication Works](authentication) — understand the two-auth model
- **Manual setup**: See the [Azure Portal Setup appendix](setup#appendix-manual-setup-azure-portal) if you can't use Teams CLI

---

## Next steps

- [Teams Features](teams-features) — mentions, adaptive cards, suggested actions
- [Middleware](middleware) — extend the turn pipeline
- [Language guides](languages/) — deeper framework-specific guidance
- [Setup Guide](setup) — full setup walkthrough from zero
- [Authentication](authentication) — how the two-auth model works under the hood
