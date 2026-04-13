---
layout: default
title: Getting Started
nav_order: 2
---

# Getting Started
{: .no_toc }

Build and run an echo bot in under five minutes.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Azure subscription** | You need an Azure AD app registration and a Bot Framework channel registration. See [Authentication & Setup](auth-setup). |
| **Tunnel tool** | [Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/) or [ngrok](https://ngrok.com/) to expose your local port to the Bot Framework Service. |
| **.NET 10 SDK** | Required for the C# implementation. |
| **Node.js 20+** | Required for the TypeScript implementation. |
| **Python 3.11+** | Required for the Python implementation. |

You only need the runtime for the language you choose.

---

## Environment variables

All three implementations read the same four variables. Set them in your shell or in a `.env` file before running.

| Variable | Description |
|---|---|
| `CLIENT_ID` | Your Azure AD application (bot) ID |
| `CLIENT_SECRET` | The corresponding Azure AD client secret |
| `TENANT_ID` | Your Azure AD tenant ID (or `common` for multi-tenant) |
| `PORT` | HTTP listen port — defaults to `3978` if not set |

```bash
export CLIENT_ID="<your-app-id>"
export CLIENT_SECRET="<your-secret>"
export TENANT_ID="<your-tenant-id>"
```

---

## Echo bot quickstart

Pick your language. Each example registers a handler for `message` activities and replies with the user's text.

### .NET

```csharp
using Botas;

var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();
```

**Run it:**

```bash
cd dotnet
dotnet run --project samples/EchoBot
```

{: .note }
The .NET port provides `BotApp.Create()` for zero-boilerplate setup. Auth middleware and the `/api/messages` endpoint are wired automatically. For advanced ASP.NET Core integration (custom DI, middleware, multi-bot hosting), see the [.NET language guide](dotnet).

### Node.js

```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

**Run it:**

```bash
cd node
npm install && npm run build
npx tsx samples/echo-bot/index.ts
```

{: .note }
The `botas-express` package provides `BotApp` for zero-boilerplate Express setup. For manual Express/Hono integration or custom middleware, see the [Node.js language guide](nodejs).

### Python

```python
from botas import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

**Run it:**

```bash
cd python/packages/botas
pip install -e ".[dev]"
cd ../../samples/echo-bot
python main.py
```

{: .note }
The Python port provides `BotApp` for zero-boilerplate setup with aiohttp. For FastAPI, aiohttp with custom middleware, or other frameworks, see the [Python language guide](python).

---

## Test your bot

1. **Start a tunnel** so the Bot Framework Service can reach your local machine:

   ```bash
   # Dev Tunnels
   devtunnel host -p 3978 --allow-anonymous

   # or ngrok
   ngrok http 3978
   ```

2. **Update the messaging endpoint** in your Bot Framework channel registration (Azure Portal → Bot resource → Configuration) to point to your tunnel URL + `/api/messages`.

3. **Send a message** using one of these options:

   - **Bot Framework Emulator** — enter `http://localhost:3978/api/messages` as the endpoint, along with your `CLIENT_ID` and `CLIENT_SECRET`.
   - **Web Chat** — open the Web Chat test panel in the Azure Portal for your bot resource.
   - **Microsoft Teams** — if your bot is registered as a Teams app, message it directly.

You should see your message echoed back.

---

## Next steps

- [Language guides](languages/) — deeper coverage of each implementation
- [Middleware](middleware) — extend the turn pipeline with logging, error handling, and more
- [Authentication & Setup](auth-setup) — full walkthrough of Azure registration and credentials
