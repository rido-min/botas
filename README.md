
# BotAS — Bot ApplicationS

![BotAS logo: stylized blue and white square icon representing a bot application framework](art/icon-128.png)

[![CI](https://github.com/rido-min/botas/actions/workflows/CI.yml/badge.svg)](https://github.com/rido-min/botas/actions/workflows/CI.yml)
[![CD](https://github.com/rido-min/botas/actions/workflows/CD.yml/badge.svg)](https://github.com/rido-min/botas/actions/workflows/CD.yml)
[![NuGet](https://img.shields.io/nuget/v/Botas.svg)](https://www.nuget.org/packages/Botas/)
[![npm](https://img.shields.io/npm/v/botas-core.svg)](https://www.npmjs.com/package/botas-core)
[![PyPI](https://img.shields.io/pypi/v/botas.svg)](https://pypi.org/project/botas/)

A lightweight, multi-language library for building [Microsoft Teams](https://learn.microsoft.com/azure/bot-service/) bots in **.NET**, **Node.js**, and **Python**.

📖 **[Full Documentation](https://rido-min.github.io/botas/)** — guides, API reference, and samples for all three languages.

---

## Quickstart

### Prerequisites

1. **Teams CLI** — creates bot registrations and provides credentials:

   ```bash
   npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
   teams login
   ```

   > 💡 Using GitHub Copilot? Ask the `/teams-bot-infra` skill to walk you through this interactively.

2. **Dev tunnel** — exposes your local port so Microsoft Teams can reach your bot. Install [Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/get-started) or [ngrok](https://ngrok.com/).

3. **Language runtime** (pick one): .NET 10 SDK · Node.js 20+ · Python 3.11+

---

### Step 1 — Start a dev tunnel

```bash
devtunnel host -p 3978 --allow-anonymous
```

Copy the HTTPS URL from the output (e.g. `https://your-tunnel.devtunnels.ms`).

> Using ngrok instead? Run `ngrok http 3978` and copy the `Forwarding` URL.

---

### Step 2 — Create the Teams app

```bash
teams app create --name "MyBot" --endpoint "https://<tunnel-url>/api/messages" --json
```

The command outputs JSON with your credentials and an install link. Save the credentials for your language:

<details>
<summary><b>.NET</b> — add to <code>appsettings.json</code></summary>

```json
{
  "AzureAd": {
    "ClientId": "<CLIENT_ID from output>",
    "ClientSecret": "<CLIENT_SECRET from output>",
    "TenantId": "<TENANT_ID from output>"
  }
}
```

</details>

<details>
<summary><b>Node.js / Python</b> — create a <code>.env</code> file</summary>

```env
CLIENT_ID=<from output>
CLIENT_SECRET=<from output>
TENANT_ID=<from output>
```

</details>

> 📌 Keep the `installLink` from the output — you'll use it to add the bot to Teams.

---

### Step 3 — Run the echo bot

#### .NET

```csharp
using Botas;

var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();
```

```bash
cd dotnet && dotnet run --project samples/EchoBot
```

#### Node.js

```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

```bash
cd node && npm install && npm run build && npx tsx samples/echo-bot/index.ts
```

#### Python

```python
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

```bash
cd python/samples/echo-bot && pip install -e . && python main.py
```

---

### Try it

Open the `installLink` from Step 2 in your browser to add the bot to Microsoft Teams, then send it a message. You should see your message echoed back.

---

## Learn more

| Topic | Link |
|---|---|
| Language guides | [.NET](https://rido-min.github.io/botas/languages/dotnet) · [Node.js](https://rido-min.github.io/botas/languages/nodejs) · [Python](https://rido-min.github.io/botas/languages/python) |
| Teams features | [Mentions, Adaptive Cards, Suggested Actions](https://rido-min.github.io/botas/teams-features) |
| Middleware | [Extend the turn pipeline](https://rido-min.github.io/botas/middleware) |
| AI bots | [LLM integration samples](https://rido-min.github.io/botas/getting-started#ai-bot) |
| Manual auth setup | [Azure portal walkthrough](https://rido-min.github.io/botas/auth-setup) (without Teams CLI) |
| Architecture | [Turn pipeline, auth model, middleware](specs/Architecture.md) |
| Contributing | [Build & test, CI, adding a new language](specs/Contributing.md) |
