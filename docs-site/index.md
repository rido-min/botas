---
layout: home

hero:
  name: BotAS
  text: The Bot App SDK
  tagline: A lightweight, multi-language library for building Microsoft Teams bots with minimal overhead.
  image:
    src: /logo.svg
    alt: BotAS Logo
  actions:
    - theme: brand
      text: Getting Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/rido-min/botas

features:
  - title: .NET (C#)
    icon:
      src: /icons/dotnet.svg
    details: Idiomatic ASP.NET Core integration with zero-boilerplate BotApp setup.
    link: /languages/dotnet
  - title: Node.js (TypeScript)
    icon:
      src: /icons/npm.svg
    details: Express and Hono support with async-first design.
    link: /languages/nodejs
  - title: Python
    icon:
      src: /icons/python.svg
    details: aiohttp and FastAPI integration with Pydantic models.
    link: /languages/python
---

## What is BotAS?

**BotAS** provides idiomatic implementations for building Microsoft Teams bots in three languages — **.NET (C#)**, **Node.js (TypeScript)**, and **Python** — with full behavioral parity across all ports.

Build bots that work with Microsoft Teams using the language and web framework you already know.

> 🤖 **Built by Copilot Squads:** This project is an experiment in AI-powered software development. All code, documentation, and samples were created by GitHub Copilot agents working as a cross-functional team. Learn about [the Squad](https://github.com/rido-min/botas#-the-squad).

## Echo Bot in 3 Languages

::: code-group
```csharp [.NET]
using Botas;

var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();
```

```typescript [Node.js]
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

```python [Python]
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```
:::

## Quick Links

- [Getting Started](getting-started) — Set up credentials and run your first bot in 5 minutes
- [Setup Guide](setup) — Step-by-step setup from zero to working bot
- [Languages](languages/) — Language-specific guides for .NET, Node.js, and Python
- [Teams Features](teams-features) — Mentions, Adaptive Cards, Suggested Actions, and Typing Indicators
- [Middleware](middleware) — Extend the turn pipeline with custom middleware
- [Logging](logging) — Configure logging in .NET, Node.js, and Python
- [Authentication](authentication) — How the two-auth model works under the hood

## API Reference

- 📘 [.NET API Reference](/api/generated/dotnet/api/Botas.html) — Generated with DocFX
- 📗 Node.js API Reference: [botas-core](/api/generated/nodejs/botas-core/index.html) · [botas-express](/api/generated/nodejs/botas-express/index.html) — Generated with TypeDoc
- 📙 Python API Reference: [botas](/api/generated/python/botas/index.html) · [botas-fastapi](/api/generated/python/botas-fastapi/index.html) — Generated with pdoc

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

Licensed under the MIT License. See [LICENSE](../LICENSE) for details.

Built with ❤️ by the [Copilot Squad](https://github.com/rido-min/botas#-the-squad).
