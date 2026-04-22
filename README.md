
# BotAS — The Bot App SDK

![BotAS logo: stylized blue and white square icon representing a bot application](art/icon-128.png)

[![CI](https://github.com/rido-min/botas/actions/workflows/CI.yml/badge.svg)](https://github.com/rido-min/botas/actions/workflows/CI.yml)
[![CD](https://github.com/rido-min/botas/actions/workflows/CD.yml/badge.svg)](https://github.com/rido-min/botas/actions/workflows/CD.yml)
[![NuGet](https://img.shields.io/nuget/v/Botas.svg)](https://www.nuget.org/packages/Botas/)
[![npm](https://img.shields.io/npm/v/botas-core.svg)](https://www.npmjs.com/package/botas-core)
[![PyPI](https://img.shields.io/pypi/v/botas.svg)](https://pypi.org/project/botas/)

A lightweight, multi-language library for building [Microsoft Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/) bots in **.NET**, **Node.js**, and **Python**.

📖 **[Full Documentation](https://rido-min.github.io/botas/)** — guides, API reference, and samples for all three languages.

---

## Quickstart

### Prerequisites

- **Teams CLI** — creates bot registrations and provides credentials:
  ```bash
  npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
  teams login
  ```
- **Dev tunnel** — exposes your local port. Install [Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/get-started).
- **Language runtime** (pick one): .NET 10 SDK · Node.js 20+ · Python 3.11+

> Need detailed setup? See the [Setup Guide](https://rido-min.github.io/botas/setup).

---

### Create app and get credentials

```bash
# Start a dev tunnel
devtunnel create --allow-anonymous my-tunnel
devtunnel port create -p 3978 my-tunnel
devtunnel host my-tunnel

# Create the Teams app (use the tunnel URL from above)
teams app create --name "MyBot" --endpoint "https://<tunnel-url>/api/messages" --json
```

Save the credentials to a `.env` file at the repo root:

```dotenv
CLIENT_ID=<from output>
CLIENT_SECRET=<from output>
TENANT_ID=<from output>
```

> 💡 Node.js and Python load `.env` directly. For .NET, run `node dotnet/env-to-launch-settings.mjs EchoBot` to bridge it to `launchSettings.json`.

---

### Run the echo bot

#### .NET

```csharp
using Botas;

var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();
```

```bash
node dotnet/env-to-launch-settings.mjs EchoBot   # creates launchSettings.json from .env
cd dotnet && dotnet run --project samples/EchoBot
```

#### Node.js

```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

```bash
cd node && npm ci && npm run build && npx tsx --env-file ../.env samples/echo-bot/index.ts
```

#### Python

```python
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

```bash
cd python/samples/echo-bot
uv run --env-file ../../.env main.py
```

> No uv? Use `pip install -e . && python main.py` instead.

---

### Test your bot

Open the `installLink` from the Teams CLI output in your browser to add the bot to Teams. Send it a message and you should see your echo reply.

---

## Learn more

| Topic | Link |
|---|---|
| Setup guide | [Step-by-step setup from zero](https://rido-min.github.io/botas/setup) |
| Language guides | [.NET](https://rido-min.github.io/botas/languages/dotnet) · [Node.js](https://rido-min.github.io/botas/languages/nodejs) · [Python](https://rido-min.github.io/botas/languages/python) |
| Teams features | [Mentions, Adaptive Cards, Suggested Actions](https://rido-min.github.io/botas/teams-features) |
| Middleware | [Extend the turn pipeline](https://rido-min.github.io/botas/middleware) |
| AI bots | [LLM integration samples](https://rido-min.github.io/botas/getting-started#ai-bot) |
| Authentication | [How auth works under the hood](https://rido-min.github.io/botas/authentication) |
| Architecture | [Turn pipeline, auth model, middleware](specs/architecture.md) |
| Contributing | [Build & test, CI, adding a new language](specs/contributing.md) |
