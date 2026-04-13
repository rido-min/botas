# Samples

**Purpose**: Walkthrough of each BotAS sample with annotated code and expected behavior.
**Status**: Draft

---

## Sample Matrix

| Sample | .NET | Node.js | Python | What it demonstrates |
|--------|------|---------|--------|---------------------|
| Echo Bot | `dotnet/samples/EchoBot` | `node/samples/echo-bot` | `python/samples/echo-bot` | Minimal bot using the simple `BotApp` API |
| Echo Bot (no mention) | — | — | `python/samples/echo-bot-no-mention` | Echo bot with `RemoveMentionMiddleware` |
| Mention Bot | `dotnet/samples/MentionBot` | — | — | `RemoveMentionMiddleware` usage |
| Teams Sample | `dotnet/samples/TeamsSample` | `node/samples/teams-sample` | `python/samples/teams-sample` | Mentions, adaptive cards, and suggested actions |
| Express (manual) | — | `node/samples/express` | — | Manual Express setup with custom routes |
| Hono (manual) | — | `node/samples/hono` | — | Manual Hono setup |
| FastAPI (manual) | — | — | `python/samples/fastapi` | Manual FastAPI setup with custom routes |
| aiohttp (manual) | — | — | `python/samples/aiohttp` | Manual aiohttp setup |
| ASP.NET Hosting | `dotnet/samples/AspNetHosting` | — | — | Manual ASP.NET Core DI/middleware setup |

---

## Prerequisites

All samples require:

1. Bot credentials in a `.env` file at the repo root (see [Infrastructure Setup](./Setup.md))
2. A tunnel exposing port 3978 (devtunnels or ngrok)
3. The language runtime installed (see [README](../README.md#prerequisites))

---

## Echo Bot

The simplest possible bot — receives a message, echoes it back.

### .NET — `dotnet/samples/EchoBot`

```csharp
using Botas;

var app = BotApp.Create(args);

app.On("message", async (context, ct) =>
{
    await context.SendAsync($"Echo: {context.Activity.Text}, from aspnet", ct);
});

app.Run();
```

**Run**: `cd dotnet && dotnet run --project samples/EchoBot`

### Node.js — `node/samples/echo-bot`

```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

**Run**: `cd node && npx tsx samples/echo-bot/index.ts`

### Python — `python/samples/echo-bot`

```python
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

**Run**: `cd python/samples/echo-bot && python main.py`

### Expected behavior

| User sends | Bot replies |
|-----------|------------|
| `hello` | `Echo: hello, from aspnet` (.NET) / `You said: hello` (Node/Python) |
| *(empty)* | Handles gracefully — no crash |

---

## Mention Bot / Echo Bot (no mention)

Demonstrates `RemoveMentionMiddleware`, which strips the bot's `@mention` from incoming text in Teams group chats.

### .NET — `dotnet/samples/MentionBot`

```csharp
using Botas;

var app = BotApp.Create(args);
app.Use(new RemoveMentionMiddleware());

app.On("message", async (context, ct) =>
{
    await context.SendAsync($"You said: {context.Activity.Text}", ct);
});

app.Run();
```

**Run**: `cd dotnet && dotnet run --project samples/MentionBot`

### Python — `python/samples/echo-bot-no-mention`

```python
from botas import BotApp, RemoveMentionMiddleware

app = BotApp()
app.use(RemoveMentionMiddleware())

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

**Run**: `cd python/samples/echo-bot-no-mention && python main.py`

### Expected behavior

| User sends (Teams) | Handler receives |
|--------------------|-----------------|
| `@MyBot what's up?` | `what's up?` |
| `hello` (no mention) | `hello` |

---

## Teams Sample

Demonstrates rich Teams interactions: @mentions, adaptive cards, and suggested actions using `TeamsActivityBuilder`.

### .NET — `dotnet/samples/TeamsSample`

The bot uses `RemoveMentionMiddleware` and dispatches on the cleaned message text:

- **"cards"** → Sends an Adaptive Card
- **"actions"** → Sends suggested action buttons (Cards / Mention / Actions)
- **Anything else** → Echoes back with an @mention of the sender

**Run**: `cd dotnet && dotnet run --project samples/TeamsSample`

### Node.js — `node/samples/teams-sample`

Same behavior as .NET, using `botas-express` and `TeamsActivityBuilder`:

**Run**: `cd node && npx tsx samples/teams-sample/index.ts`

### Python — `python/samples/teams-sample`

Same behavior, using `botas_fastapi` and `TeamsActivityBuilder`:

**Run**: `cd python/samples/teams-sample && python main.py`

### Expected behavior

| User sends | Bot response |
|-----------|-------------|
| `cards` | An Adaptive Card with "Hello from TeamsSample!" |
| `actions` | Three quick-reply buttons: 🃏 Cards, 👋 Mention, ⚡ Actions |
| `hello` | `@User said: hello` (with a live mention) |

---

## Manual Framework Samples

These samples show how to use `BotApplication` directly with a web framework for full control over routes, middleware, and server lifecycle.

### Express — `node/samples/express`

Manual Express setup with:
- Request logging middleware
- Custom `/health` endpoint
- `botAuthExpress()` for JWT validation
- Handlers for `message` and `conversationUpdate`

**Run**: `cd node && npx tsx samples/express/index.ts`

### Hono — `node/samples/hono`

Manual Hono setup with:
- `botAuthHono()` middleware
- `processBody()` instead of `processAsync()` (Hono owns the response)
- `/health` endpoint

**Run**: `cd node && npx tsx samples/hono/index.ts`

### FastAPI — `python/samples/fastapi`

Manual FastAPI setup with:
- `bot_auth_dependency()` for JWT validation as a FastAPI dependency
- Custom root and `/health` endpoints
- Handlers for `message` and `conversationUpdate`

**Run**: `cd python/samples/fastapi && uvicorn main:app --port 3978`

### aiohttp — `python/samples/aiohttp`

Manual aiohttp setup with:
- `validate_bot_token()` called explicitly in the route handler
- `/health` endpoint
- Handlers for `message` and `conversationUpdate`

**Run**: `cd python/samples/aiohttp && python main.py`

### ASP.NET Core Hosting — `dotnet/samples/AspNetHosting`

Manual ASP.NET Core setup with:
- `AddBotApplication<BotApplication>()` for full DI registration
- `UseBotApplication<BotApplication>()` to wire up the route
- Custom root endpoint

**Run**: `cd dotnet && dotnet run --project samples/AspNetHosting`

---

## Key Differences Between Simple and Manual Samples

| Concern | Simple (`BotApp`) | Manual (`BotApplication`) |
|---------|-------------------|--------------------------|
| Server setup | Automatic | You configure the web framework |
| Auth wiring | Automatic | You call the auth helper |
| Route registration | Automatic (`/api/messages`) | You define the route |
| Custom routes | Not supported (use manual) | Full control |
| Custom DI | Not supported (use manual) | Full control |

---

## References

- [README — Quick Start](../README.md#echo-bot--quick-start) — condensed getting-started
- [Infrastructure Setup](./Setup.md) — bot registration and credentials
- [Configuration](./Configuration.md) — env vars and options
- [Teams Activity](./teams-activity.md) — `TeamsActivityBuilder` spec
- [Middleware](./Middleware.md) — middleware pipeline spec
