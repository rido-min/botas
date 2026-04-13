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

### .NET (ASP.NET Core)

```csharp
using Botas;

WebApplicationBuilder webAppBuilder = WebApplication.CreateSlimBuilder(args);
webAppBuilder.Services.AddBotApplication<BotApplication>();
WebApplication webApp = webAppBuilder.Build();
var botApp = webApp.UseBotApplication<BotApplication>();

botApp.OnActivity = async (activity, ct) =>
{
    await botApp.SendActivityAsync(
        activity.CreateReplyActivity($"You said: {activity.Text}"), ct);
};

webApp.Run();
```

**Run it:**

```bash
cd dotnet
dotnet run --project samples/EchoBot
```

{: .note }
The .NET port uses `AddBotApplication` / `UseBotApplication` extension methods for ASP.NET Core DI. Auth middleware and the `/api/messages` endpoint are wired automatically.

### Node.js (Express)

```typescript
import express from 'express'
import { BotApplication, botAuthExpress, createReplyActivity } from 'botas'

const bot = new BotApplication()

bot.on('message', async (activity) => {
  await bot.sendActivityAsync(
    activity.serviceUrl,
    activity.conversation.id,
    createReplyActivity(activity, `You said: ${activity.text}`)
  )
})

const server = express()

server.post('/api/messages', botAuthExpress(), (req, res) => {
  bot.processAsync(req, res)
})

const PORT = Number(process.env['PORT'] ?? 3978)
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}/api/messages`)
})
```

**Run it:**

```bash
cd node
npm install && npm run build
npx tsx samples/express/index.ts
```

{: .note }
`botAuthExpress()` is Express middleware that validates the inbound JWT. Credentials are auto-detected from the `CLIENT_ID` / `CLIENT_SECRET` / `TENANT_ID` environment variables.

### Python (FastAPI)

```python
from botas import BotApplication, bot_auth_dependency, create_reply_activity
from fastapi import Depends, FastAPI, Request

bot = BotApplication()

@bot.on("message")
async def on_message(activity):
    await bot.send_activity_async(
        activity.service_url,
        activity.conversation.id,
        create_reply_activity(activity, f"You said: {activity.text}"),
    )

app = FastAPI()

@app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
async def messages(request: Request):
    body = await request.body()
    await bot.process_body(body.decode())
    return {}
```

**Run it:**

```bash
cd python/packages/botas
pip install -e ".[dev]"
cd ../../samples/fastapi
uvicorn main:app --port 3978
```

{: .note }
`bot_auth_dependency()` is a FastAPI dependency that validates the inbound JWT. The endpoint must return `{}` on success.

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
