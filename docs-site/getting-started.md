---
outline: deep
---

# Getting Started

Build and run an echo bot in under five minutes.

## Prerequisites

1. **Teams CLI** — creates bot registrations and provides credentials:

   ```bash
   npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
   teams login
   ```

2. **Dev tunnel** — exposes your local port so Microsoft Teams can reach your bot. Install [Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/get-started) or [ngrok](https://ngrok.com/).

3. **Language runtime** (pick one):
   - **.NET 10 SDK** — for the C# implementation
   - **Node.js 20+** — for the TypeScript implementation
   - **Python 3.11+** — for the Python implementation

::: tip
Don't have the Teams CLI? You can also set up credentials manually through the Azure portal — see [Authentication & Setup](auth-setup).
:::

---

## Step 1 — Start a dev tunnel

```bash
devtunnel host -p 3978 --allow-anonymous
```

Copy the HTTPS URL from the output (e.g. `https://your-tunnel.devtunnels.ms`).

::: details Using ngrok instead?
```bash
ngrok http 3978
```
Copy the `Forwarding` HTTPS URL from the output.
:::

::: warning
Tunnel URLs are ephemeral — they change each time you restart. If you switch tunnels, update the endpoint with `teams app edit <appId> --endpoint "https://<new-url>/api/messages"`.
:::

---

## Step 2 — Create the Teams app

```bash
teams app create --name "MyBot" --endpoint "https://<tunnel-url>/api/messages" --json
```

The command returns JSON with your credentials and an install link:

```json
{
  "credentials": {
    "CLIENT_ID": "...",
    "CLIENT_SECRET": "...",
    "TENANT_ID": "..."
  },
  "installLink": "https://teams.microsoft.com/l/app/..."
}
```

Save the credentials for your language:

::: code-group
```json [.NET — appsettings.json]
{
  "AzureAd": {
    "ClientId": "<CLIENT_ID from output>",
    "ClientSecret": "<CLIENT_SECRET from output>",
    "TenantId": "<TENANT_ID from output>"
  }
}
```

```env [Node.js — .env]
CLIENT_ID=<from output>
CLIENT_SECRET=<from output>
TENANT_ID=<from output>
```

```env [Python — .env]
CLIENT_ID=<from output>
CLIENT_SECRET=<from output>
TENANT_ID=<from output>
```
:::

Keep the `installLink` — you'll use it to add the bot to Teams after the server is running.

---

## Step 3 — Run the echo bot

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

---

## Try it

1. Open the `installLink` from Step 2 in your browser to add the bot to Microsoft Teams.
2. Send it a message — you should see your text echoed back.

::: info
Each language provides a zero-boilerplate `BotApp` wrapper. For advanced integration (custom DI, middleware, alternative frameworks), see the language guides: [.NET](languages/dotnet) · [Node.js](languages/nodejs) · [Python](languages/python).
:::

---

## Next steps

- [Teams Features](teams-features) — send mentions, adaptive cards, and suggested actions
- [Language guides](languages/) — deeper coverage of each implementation
- [Middleware](middleware) — extend the turn pipeline with logging, error handling, and more
- [Authentication & Setup](auth-setup) — manual Azure portal setup (without Teams CLI)
