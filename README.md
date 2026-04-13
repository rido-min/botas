
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

Run:
```bash
cd dotnet
dotnet run --project samples/EchoBot
```

For advanced ASP.NET Core integration scenarios (custom DI, middleware, or multi-bot hosting), see the [.NET language guide](https://rido-min.github.io/botas/languages/dotnet).

### Node.js

```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

Run:
```bash
cd node
npm install && npm run build
npx tsx samples/echo-bot/index.ts
```

For manual Express, Hono, or other framework integration, see the [Node.js language guide](https://rido-min.github.io/botas/languages/nodejs).

### Python

```python
from botas import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

Run:
```bash
cd python/packages/botas
pip install -e ".[dev]"
cd ../../samples/echo-bot
python main.py
```

For manual FastAPI, aiohttp, or other framework integration, see the [Python language guide](https://rido-min.github.io/botas/languages/python).

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
