---
outline: deep
---

# Getting Started

Build and run an echo bot in under five minutes.

## Prerequisites

| Requirement | Details |
|---|---|
| **Azure subscription** | You need an Azure AD app registration and a Bot Framework channel registration. See [Authentication & Setup](auth-setup). |
| **Tunnel tool** | [Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/) or [ngrok](https://ngrok.com/) to expose your local port to the Bot Framework Service. |
| **.NET 10 SDK** | Required for the C# implementation. |
| **Node.js 20+** | Required for the TypeScript implementation. |
| **Python 3.11+** | Required for the Python implementation. |

You only need the runtime for the language you choose.

---

## Environment variables

All three implementations read the same four variables. Set them in your shell or in a `.env` file before running.

| Variable | Description |
|---|---|
| `CLIENT_ID` | Your Azure AD application (bot) ID |
| `CLIENT_SECRET` | The corresponding Azure AD client secret |
| `TENANT_ID` | Your Azure AD tenant ID (or `common` for multi-tenant) |
| `PORT` | HTTP listen port — defaults to `3978` if not set |

```bash
export CLIENT_ID="<your-app-id>"
export CLIENT_SECRET="<your-secret>"
export TENANT_ID="<your-tenant-id>"
```

---

## Echo bot quickstart

Pick your language. Each example registers a handler for `message` activities and replies with the user's text.

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

### Run it

::: code-group
```bash [.NET]
cd dotnet
dotnet run --project samples/EchoBot
```

```bash [Node.js]
cd node
npm install && npm run build
npx tsx samples/echo-bot/index.ts
```

```bash [Python]
cd python/samples/echo-bot
pip install -e .
python main.py
```
:::

::: info
Each language provides a zero-boilerplate `BotApp` wrapper. For advanced integration (custom DI, middleware, alternative frameworks), see the language guides: [.NET](languages/dotnet) · [Node.js](languages/nodejs) · [Python](languages/python).
:::

---

## Test your bot

1. **Start a tunnel** so the Bot Framework Service can reach your local machine:

   ```bash
   # Dev Tunnels
   devtunnel host -p 3978 --allow-anonymous

   # or ngrok
   ngrok http 3978
   ```

2. **Update the messaging endpoint** in your Bot Framework channel registration (Azure Portal → Bot resource → Configuration) to point to your tunnel URL + `/api/messages`.

3. **Send a message** using one of these options:

   - **Bot Framework Emulator** — enter `http://localhost:3978/api/messages` as the endpoint, along with your `CLIENT_ID` and `CLIENT_SECRET`.
   - **Web Chat** — open the Web Chat test panel in the Azure Portal for your bot resource.
   - **Microsoft Teams** — if your bot is registered as a Teams app, message it directly.

You should see your message echoed back.

---

## Next steps

- [Teams Features](teams-features) — send mentions, adaptive cards, and suggested actions
- [Language guides](languages/) — deeper coverage of each implementation
- [Middleware](middleware) — extend the turn pipeline with logging, error handling, and more
- [Authentication & Setup](auth-setup) — full walkthrough of Azure registration and credentials
