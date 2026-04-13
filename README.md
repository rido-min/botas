
# BotAS — Bot ApplicationS

![BotAS logo: stylized blue and white square icon representing a bot application framework](art/icon-128.png)


A lightweight, multi-language library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots. Implementations exist for **.NET (C#)**, **TypeScript/Node.js**, and **Python**, with behavioral parity across all three.

📖 **[Full Documentation](https://rido-min.github.io/botas/)** — guides, API reference, and samples for all three languages.

## What it does

BotAS handles the plumbing so you can focus on bot logic:

- Validates inbound JWT tokens from the Bot Framework Service
- Deserializes activities and dispatches them to registered handlers
- Runs a configurable middleware pipeline before each handler
- Authenticates outbound HTTP calls using OAuth2 client credentials
- Preserves unknown JSON properties so custom channel data round-trips safely

## Getting started

### Prerequisites

- Azure AD app registration and Bot Framework channel registration — see [Infrastructure Setup](specs/Setup.md)
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
        await botApp.SendActivityAsync(activity.CreateReplyActivity($"You said: {activity.Text}"), ct);
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
import { BotApplication, botAuthExpress, CoreActivityBuilder } from '@botas/botas'

const bot = new BotApplication()

bot.on('message', async (activity) => {
  const reply = new CoreActivityBuilder()
    .withConversationReference(activity)
    .withText(`You said: ${activity.text}`)
    .build()
  await bot.sendActivityAsync(activity.serviceUrl, activity.conversation.id, reply)
})

const server = express()
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
from botas import BotApplication, CoreActivityBuilder, bot_auth_dependency

bot = BotApplication()

@bot.on("message")
async def on_message(activity):
    reply = (
        CoreActivityBuilder()
        .with_conversation_reference(activity)
        .with_text(f"You said: {activity.text}")
        .build()
    )
    await bot.send_activity_async(
        activity.service_url,
        activity.conversation.id,
        reply,
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
cd ../../samples/fastapi
uvicorn main:app --port 3978
```

---

## Repository layout

```
botas/
├── dotnet/           .NET library + ASP.NET Core integration + EchoBot sample
├── node/             TypeScript library + Express and Hono samples
├── python/           Python library + FastAPI and aiohttp samples
├── specs/            Protocol specs, architecture, and setup docs
├── art/              Logo and icon assets
├── docs-site/        Jekyll documentation website
├── AGENTS.md         Guide for porting to new languages
└── README.md
```

## Documentation

| Document | Description |
|---|---|
| [Full Documentation Site](https://rido-min.github.io/botas/) | Complete guides, API reference, and samples for all three languages |
| [Architecture](specs/Architecture.md) | Turn pipeline, two-auth model, middleware, schema |
| [Infrastructure Setup](specs/Setup.md) | Register a bot and get credentials using the Azure portal |
| [specs/README.md](specs/README.md) | Full feature specification and API surface per language |
| [AGENTS.md](AGENTS.md) | Porting guide for new language implementations |

## Suggested additional docs

The following areas are good candidates for future documentation:

- **`specs/ActivityPayloads.md`** — Annotated JSON examples for each activity type (`message`, `conversationUpdate`, `messageReaction`, `invoke`, `installationUpdate`)
- **`specs/Configuration.md`** — Per-language configuration reference: env vars, DI wiring (.NET), options objects (Node), constructor args (Python), managed identity setup
- **`specs/Middleware.md`** — How to write and register middleware, execution order, short-circuiting, and example patterns (logging, error handling, feature flags)
- **`specs/ProactiveMessaging.md`** — How to send messages outside of a turn using `ConversationClient`
- **`specs/Samples.md`** — Walkthrough of each sample (EchoBot, aiohttp, Hono) with annotated code and expected behavior
- **`specs/Contributing.md`** — Behavioral invariants, CI setup, how to add a new language port

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
