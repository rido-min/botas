# Samples

**Purpose**: Guide to running each botas sample.
**Status**: Draft

---

## Sample Matrix

| Sample | .NET | Node.js | Python | What it demonstrates |
|--------|------|---------|--------|---------------------|
| Echo Bot | `dotnet/samples/01-echo-bot` | `node/samples/01-echo-bot` | `python/samples/01-echo-bot` | Minimal bot using the simple `BotApp` API |

| Teams Sample | `dotnet/samples/03-teams-features` | `node/samples/03-teams-features` | `python/samples/03-teams-features` | Mentions, adaptive cards, and suggested actions |
| Express (manual) | — | `node/samples/express` | — | Manual Express setup with custom routes |
| Hono (manual) | — | `node/samples/hono` | — | Manual Hono setup |
| FastAPI (manual) | — | — | `python/samples/fastapi` | Manual FastAPI setup with custom routes |
| aiohttp (manual) | — | — | `python/samples/aiohttp` | Manual aiohttp setup |
| ASP.NET Hosting | `dotnet/samples/AspNetHosting` | — | — | Manual ASP.NET Core DI/middleware setup |

---

## Prerequisites

All samples require:

1. Bot credentials in a `.env` file at the repo root (see [Infrastructure Setup](./setup.md))
2. A tunnel exposing port 3978 (devtunnels)
3. The language runtime installed (see [README](../README.md#prerequisites))

---

## Echo Bot

The simplest possible bot — receives a message, echoes it back.

| Language | Run command |
|----------|-------------|
| .NET | `cd dotnet && dotnet run --project samples/01-echo-bot` |
| Node.js | `cd node && npx tsx samples/echo-bot/index.ts` |
| Python | `cd python/samples/01-echo-bot && python main.py` |

---

## Teams Features

Demonstrates rich Teams interactions: @mentions, adaptive cards, suggested actions, and `RemoveMentionMiddleware` using `TeamsActivityBuilder`.

| Language | Run command |
|----------|-------------|
| .NET | `cd dotnet && dotnet run --project samples/03-teams-features` |
| Node.js | `cd node && npx tsx samples/03-teams-features/index.ts` |
| Python | `cd python/samples/03-teams-features && python main.py` |

---

## Manual Framework Samples

These samples show how to use `BotApplication` directly with a web framework for full control over routes, middleware, and server lifecycle.

| Sample | Run command |
|--------|-------------|
| Express | `cd node && npx tsx samples/express/index.ts` |
| Hono | `cd node && npx tsx samples/hono/index.ts` |
| FastAPI | `cd python/samples/fastapi && uvicorn main:app --port 3978` |
| aiohttp | `cd python/samples/aiohttp && python main.py` |
| ASP.NET Hosting | `cd dotnet && dotnet run --project samples/AspNetHosting` |

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
- [Infrastructure Setup](./setup.md) — bot registration and credentials
- [Configuration](./configuration.md) — env vars and options
- [Protocol — Middleware](./protocol.md#middleware) — middleware pipeline spec
