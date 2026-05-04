# Samples

**Purpose**: Guide to running each botas sample.
**Status**: Draft

---

## Sample Matrix

Samples are organized by topic and numbered consistently across languages so that the same number means the same scenario in every port.

| # | Topic | .NET | Node.js | Python |
|---|-------|------|---------|--------|
| 01 | Echo Bot (minimal `BotApp`) | [`dotnet/samples/01-echo-bot`](../dotnet/samples/01-echo-bot) | [`node/samples/01-echo-bot`](../node/samples/01-echo-bot) | [`python/samples/01-echo-bot`](../python/samples/01-echo-bot) |
| 02 | Advanced hosting (manual `BotApplication` + framework) | [`02-advanced-hosting-aspnet`](../dotnet/samples/02-advanced-hosting-aspnet) | [`02-advanced-hosting-express`](../node/samples/02-advanced-hosting-express), [`-hono`](../node/samples/02-advanced-hosting-hono), [`-koa`](../node/samples/02-advanced-hosting-koa), [`-deno`](../node/samples/02-advanced-hosting-deno) | [`02-advanced-hosting-fastapi`](../python/samples/02-advanced-hosting-fastapi), [`02-advanced-hosting-flask`](../python/samples/02-advanced-hosting-flask) |
| 03 | Teams features (mentions, cards, suggested actions) | [`03-teams-features`](../dotnet/samples/03-teams-features) | [`03-teams-features`](../node/samples/03-teams-features) | [`03-teams-features`](../python/samples/03-teams-features) |
| 04 | AI integrations | [`04-ai-openai`](../dotnet/samples/04-ai-openai) | [`04-ai-langchain-mcp`](../node/samples/04-ai-langchain-mcp), [`04-ai-vercel`](../node/samples/04-ai-vercel) | [`04-ai-agent-framework`](../python/samples/04-ai-agent-framework), [`04-ai-langchain`](../python/samples/04-ai-langchain) |
| 05 | Observability (OpenTelemetry) | [`05-observability`](../dotnet/samples/05-observability) | [`05-observability`](../node/samples/05-observability), [`05-ai-langchain-otel`](../node/samples/05-ai-langchain-otel) | [`05-observability`](../python/samples/05-observability) |

> The `dotnet/samples/TestBot`, `node/samples/test-bot`, and `python/samples/test-bot` directories are internal harnesses used by the e2e suite — they are not user-facing samples.

---

## Prerequisites

All samples require:

1. Bot credentials in a `.env` file at the repo root (see the [Setup Guide](../docs-site/setup.md)). Local dev can run without `CLIENT_ID` — see [no-auth note](#local-dev-without-credentials).
2. A tunnel exposing port 3978 (devtunnels) when sending real Teams/channel traffic.
3. The language runtime installed (see [README](../README.md#prerequisites)).

---

## 01 — Echo Bot

The simplest possible bot: receives a message, echoes it back. Uses the high-level `BotApp` API in every language.

| Language | Run command |
|----------|-------------|
| .NET | `cd dotnet && dotnet run --project samples/01-echo-bot` |
| Node.js | `cd node && npx tsx samples/01-echo-bot/index.ts` |
| Python | `cd python/samples/01-echo-bot && python main.py` |

---

## 02 — Advanced Hosting

These samples use `BotApplication` directly (not the high-level `BotApp`) so you control the web framework, routes, middleware, and lifecycle.

| Sample | Run command |
|--------|-------------|
| .NET — ASP.NET Core | `cd dotnet && dotnet run --project samples/02-advanced-hosting-aspnet` |
| Node.js — Express | `cd node && npx tsx samples/02-advanced-hosting-express/index.ts` |
| Node.js — Hono | `cd node && npx tsx samples/02-advanced-hosting-hono/index.ts` |
| Node.js — Koa | `cd node/samples/02-advanced-hosting-koa && npm start` |
| Node.js — Deno | `cd node/samples/02-advanced-hosting-deno && deno task start` |
| Python — FastAPI | `cd python/samples/02-advanced-hosting-fastapi && python main.py` |
| Python — Flask | `cd python/samples/02-advanced-hosting-flask && python main.py` |

---

## 03 — Teams Features

Demonstrates rich Teams interactions: @mentions, adaptive cards, suggested actions, and `RemoveMentionMiddleware` using `TeamsActivityBuilder`.

| Language | Run command |
|----------|-------------|
| .NET | `cd dotnet && dotnet run --project samples/03-teams-features` |
| Node.js | `cd node && npx tsx samples/03-teams-features/index.ts` |
| Python | `cd python/samples/03-teams-features && python main.py` |

---

## 04 — AI Integrations

Each sample shows how to wire an AI/LLM client into a bot turn.

| Sample | Run command |
|--------|-------------|
| .NET — OpenAI | `cd dotnet && dotnet run --project samples/04-ai-openai` |
| Node.js — LangChain + MCP | `cd node && npx tsx samples/04-ai-langchain-mcp/index.ts` |
| Node.js — Vercel AI SDK | `cd node && npx tsx samples/04-ai-vercel/index.ts` |
| Python — Microsoft Agent Framework | `cd python/samples/04-ai-agent-framework && python main.py` |
| Python — LangChain | `cd python/samples/04-ai-langchain && python main.py` |

---

## 05 — Observability

OpenTelemetry tracing, metrics, and logging. See the [Observability spec](./observability.md).

| Sample | Run command |
|--------|-------------|
| .NET | `cd dotnet && dotnet run --project samples/05-observability` |
| Node.js | `cd node && npx tsx samples/05-observability/index.ts` |
| Node.js — LangChain + OTel | `cd node && npx tsx samples/05-ai-langchain-otel/index.ts` |
| Python | `cd python/samples/05-observability && python main.py` |

---

## Key Differences Between Simple and Advanced Samples

| Concern | Simple (`BotApp`, sample 01) | Advanced (`BotApplication`, sample 02) |
|---------|------------------------------|----------------------------------------|
| Server setup | Automatic | You configure the web framework |
| Auth wiring | Automatic | You call the auth helper / middleware |
| Route registration | Automatic (`/api/messages`) | You define the route |
| Custom routes | Not supported | Full control |
| Custom DI | Not supported | Full control |

---

## Local dev without credentials

If `CLIENT_ID` is not set, the high-level `BotApp` framework runs without inbound JWT validation — useful for local development against the Bot Framework Emulator or unit/integration tests. See:

- [`configuration.md` — env vars](./configuration.md) (the `CLIENT_ID` row notes the no-auth fallback)
- [`inbound-auth.md` — No-auth mode](./inbound-auth.md) for the precise framework-level behavior
- [`protocol.md` — Bot ID resolution](./protocol.md) for how `appId` falls back to `activity.recipient.id` in no-auth mode

---

## References

- [README — Quick Start](../README.md#echo-bot--quick-start) — condensed getting-started
- [Setup Guide](../docs-site/setup.md) — bot registration and credentials
- [Configuration](./configuration.md) — env vars and options
- [Protocol — Middleware](./protocol.md#middleware) — middleware pipeline spec
