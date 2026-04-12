# BotAS — Bot ApplicationS

A lightweight, multi-language library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots. Implementations exist for **.NET (C#)**, **TypeScript/Node.js**, and **Python**, with behavioral parity across all three.

## What it does

BotAS handles the plumbing so you can focus on bot logic:

- Validates inbound JWT tokens from the Bot Framework Service
- Deserializes activities and dispatches them to registered handlers
- Runs a configurable middleware pipeline before each handler
- Authenticates outbound HTTP calls using OAuth2 client credentials
- Preserves unknown JSON properties so custom channel data round-trips safely

## Getting started

### Prerequisites

- Azure AD app registration and Bot Framework channel registration — see [Infrastructure Setup](docs/Setup.md)
- A tunneling tool for local dev (Microsoft devtunnels or ngrok)
- Runtime for your chosen language:
  - .NET 10.0 SDK
  - Node.js 20+
  - Python 3.11+

### Environment variables

All three implementations read the same variables:

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (or `common`) |
| `PORT` | HTTP listen port (default: `3978`) |

Copy `.env` from the repo root and fill in the values from your bot registration.

---

## Echo bot — quick start

### .NET (ASP.NET Core)

```csharp
var builder = WebApplication.CreateSlimBuilder(args);
builder.Services.AddBotApplication<BotApplication>();
var webApp = builder.Build();
var botApp = webApp.UseBotApplication<BotApplication>();

botApp.OnActivity = async (activity, ct) => {
    if (activity.Type == "message")
        await botApp.SendActivityAsync(activity.CreateReply($"You said: {activity.Text}"), ct);
};

webApp.Run();
```

Run:
```bash
cd dotnet
dotnet run --project samples/EchoBot
```

### Node.js (Express)

```typescript
import express from 'express'
import { BotApplication, botAuthExpress, createReplyActivity } from '@botas/botas'

const bot = new BotApplication()

bot.on('message', async (activity) => {
  await bot.sendActivityAsync(
    activity.serviceUrl,
    activity.conversation.id,
    createReplyActivity(activity, `You said: ${activity.text}`)
  )
})

const server = express()
server.use(express.json())
server.post('/api/messages', botAuthExpress(), (req, res) => bot.processAsync(req, res))
server.listen(process.env.PORT ?? 3978)
```

Run:
```bash
cd node
npm install && npm run build
npx tsx samples/express/index.ts
```

### Python (FastAPI)

```python
from fastapi import FastAPI, Depends, Request
from botas import BotApplication, create_reply_activity, bot_auth_dependency

bot = BotApplication()

@bot.on("message")
async def on_message(activity):
    await bot.send_activity_async(
        activity.service_url,
        activity.conversation.id,
        create_reply_activity(activity, f"You said: {activity.text}")
    )

app = FastAPI()

@app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
async def messages(request: Request):
    await bot.process_body((await request.body()).decode())
    return {}
```

Run:
```bash
cd python/packages/botas
pip install -e ".[dev]"
uvicorn samples.fastapi.main:app --port 3978
```

---

## Repository layout

```
botas/
├── dotnet/           .NET library + ASP.NET Core integration + EchoBot sample
├── node/             TypeScript library + Express and Hono samples
├── python/           Python library + FastAPI and aiohttp samples
├── docs/             Website and spec documentation
├── AGENTS.md         Guide for porting to new languages
└── README.md
    ├── Architecture.md   Turn pipeline, auth model, component overview
    └── Setup.md          Bot registration and credential setup
```

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/Architecture.md) | Turn pipeline, two-auth model, middleware, schema |
| [Infrastructure Setup](docs/Setup.md) | Register a bot and get credentials using the Azure portal |
| [docs/bot-spec.md](docs/bot-spec.md) | Full feature specification and API surface per language |
| [AGENTS.md](AGENTS.md) | Porting guide for new language implementations |

## Suggested additional docs

The following areas are good candidates for future documentation:

- **`docs/ActivityPayloads.md`** — Annotated JSON examples for each activity type (`message`, `conversationUpdate`, `messageReaction`, `invoke`, `installationUpdate`)
- **`docs/Configuration.md`** — Per-language configuration reference: env vars, DI wiring (.NET), options objects (Node), constructor args (Python), managed identity setup
- **`docs/Middleware.md`** — How to write and register middleware, execution order, short-circuiting, and example patterns (logging, error handling, feature flags)
- **`docs/ProactiveMessaging.md`** — How to send messages outside of a turn using `ConversationClient` and `UserTokenClient`
- **`docs/Samples.md`** — Walkthrough of each sample (EchoBot, aiohttp, Hono) with annotated code and expected behavior
- **`docs/Contributing.md`** — Behavioral invariants, CI setup, how to add a new language port

## Building and testing

```bash
# .NET
cd dotnet && dotnet build Botas && dotnet test

# Node
cd node && npm install && npm run build && npm test

# Python
cd python/packages/botas && pip install -e ".[dev]" && pytest

# All languages
./build-all.sh
```

CI runs all three on every push and pull request (see `.github/workflows/CI.yml`).
