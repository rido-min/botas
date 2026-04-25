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
- [Authentication](authentication) — How the two-auth model works under the hood

## API Reference

- 📘 [.NET API Reference](/api/generated/dotnet/api/Botas.html) — Generated with DocFX
- 📗 Node.js API Reference: [botas-core](/api/generated/nodejs/botas-core/index.html) · [botas-express](/api/generated/nodejs/botas-express/index.html) — Generated with TypeDoc
- 📙 Python API Reference: [botas](/api/generated/python/botas/index.html) · [botas-fastapi](/api/generated/python/botas-fastapi/index.html) — Generated with pdoc
