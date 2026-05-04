
# BotAS — The Bot App SDK

![BotAS logo: stylized blue and white square icon representing a bot application](art/icon-128.png)

[![CI](https://github.com/rido-min/botas/actions/workflows/CI.yml/badge.svg)](https://github.com/rido-min/botas/actions/workflows/CI.yml)
[![CD](https://github.com/rido-min/botas/actions/workflows/CD.yml/badge.svg)](https://github.com/rido-min/botas/actions/workflows/CD.yml)
[![NuGet](https://img.shields.io/nuget/v/Botas.svg)](https://www.nuget.org/packages/Botas/)
[![npm](https://img.shields.io/npm/v/botas-core.svg)](https://www.npmjs.com/package/botas-core)
[![JSR](https://jsr.io/badges/@botas/core)](https://jsr.io/@botas/core)
[![PyPI](https://img.shields.io/pypi/v/botas.svg)](https://pypi.org/project/botas/)

A lightweight, multi-language library for building [Microsoft Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/) bots in **.NET**, **Node.js**, and **Python**.

> 🤖 **This project is a GitHub Copilot Squads experiment.** All code, documentation, and samples have been produced by GitHub Copilot agents working as a cross-functional team. Meet the [Squad](#-the-squad) below!

📖 **[Full Documentation](https://rido-min.github.io/botas/)** · [Setup Guide](https://rido-min.github.io/botas/setup) · [Authentication](https://rido-min.github.io/botas/authentication)

---

## Ready in ~5 seconds (pick your language)


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
// node dotnet/env-to-launch-settings.mjs EchoBot
// cd dotnet && dotnet run --project samples/01-echo-bot
```

```typescript [Node.js]
// Install:
// npm install botas-core botas-express

import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()

// Run:
// cd node && npm ci && npm run build && npx tsx --env-file ../.env samples/echo-bot/index.ts
```

```typescript [Deno]
// Install (via JSR — no build step):
// deno add jsr:@botas/core

import { BotApplication, validateBotToken } from '@botas/core'

const bot = new BotApplication()

bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

Deno.serve({ port: 3978 }, async (req) => {
  if (new URL(req.url).pathname === '/api/messages') {
    const body = await req.json()
    await validateBotToken(req.headers.get('authorization') ?? '')
    await bot.processBody(body)
    return new Response('{}')
  }
  return new Response('OK')
})

// Run:
// cd node/samples/deno && deno run --allow-net --allow-env --allow-read --allow-sys main.ts
```

```python [Python]
# Install:
# uv add botas botas-fastapi

from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()

# Run:
# cd python/samples/01-echo-bot && uv run --env-file ../../.env main.py
```

---

## Setup (30 seconds)

You'll need:

- ✅ **Teams tenant access** — can sign into Microsoft Teams
- ✅ **Teams CLI** — `npm install -g @microsoft/teams.cli@preview && teams login`
- ✅ **Dev tunnel** — `devtunnel create --allow-anonymous` and `devtunnel host` (opens port 3978)
- ✅ **Bot credentials in `.env`** — run `teams app create --name "MyBot" --endpoint "https://<tunnel-url>/api/messages" --json` and save the output
- ✅ **Language runtime** — .NET 10 SDK · Node.js 20+ · Python 3.11+

See the [**Setup Guide**](https://rido-min.github.io/botas/setup) for step-by-step instructions from zero.

---

## Test your bot

Open the `installLink` from the Teams CLI output in your browser to add the bot to Teams, then send a message. Your bot will echo it back.

---

## Learn more

| Topic | Link |
|---|---|
| **Getting Started** | [Full walkthrough with Teams CLI](https://rido-min.github.io/botas/getting-started) |
| **Language guides** | [.NET](https://rido-min.github.io/botas/languages/dotnet) · [Node.js](https://rido-min.github.io/botas/languages/nodejs) · [Python](https://rido-min.github.io/botas/languages/python) |
| **Teams features** | [Mentions, Adaptive Cards, Suggested Actions](https://rido-min.github.io/botas/teams-features) |
| **Middleware** | [Extend the turn pipeline](https://rido-min.github.io/botas/middleware) |
| **Observability** | [OpenTelemetry tracing, metrics, logs](https://rido-min.github.io/botas/observability) |
| **Authentication** | [Two-auth model deep dive](https://rido-min.github.io/botas/authentication) |
| **Architecture** | [Turn pipeline, auth flow, middleware](specs/architecture.md) |
| **Contributing** | [Build & test, CI, adding a new language](specs/contributing.md) |

---

## 🚀 The Squad

This project was built by **GitHub Copilot** agents working as a cross-functional team — each bringing their own expertise, opinions, and inexplicable obsession with proper error handling.

| Agent | Role | Superpower | Where They're From |
|-------|------|-----------|-------------------|
| **Leela** | 🧠 Product & Architecture Lead | Making hard decisions so others don't have to | Planet Omicron Persei 8 |
| **Amy** | 🔷 .NET Developer | C# elegance and unwavering consistency | Her parents' basement |
| **Fry** | 📘 Node.js Developer | TypeScript sophistication with a 20th-century attitude | 2 centuries in the past |
| **Hermes** | 🐍 Python Developer | Pythonic grace under pressure | Jamaica, mon |
| **Kif** | 📚 Developer Relations | Docs that don't require reading the source code | Leela's shadow (literally) |
| **Nibbler** | 🧪 E2E Tester & QA | Finds bugs nobody knew existed | Dimension X |
| **Bender** | 🔧 DevOps & Infrastructure | Robots helping robots | Puerto Sigada |

**Why agents?** Because only an AI could maintain behavior parity across three languages and still have time for a coffee break. Plus, they don't complain in standups (yet).

---

## 📝 License

Licensed under the MIT License. See [LICENSE](LICENSE) for details.

Built with ❤️ by the [Copilot Squad](https://github.com/rido-min/botas/team/squad).
