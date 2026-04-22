---
outline: deep
---

# Setup Guide

This guide walks you through setting up a Teams bot with botas from zero — installing tools, getting credentials, and testing your first message.

If you already have credentials and just want to see code, check out [Getting Started](getting-started).

---

## Prerequisites

Before you begin, install these tools:

### Teams CLI

The Teams CLI automates bot registration and credential provisioning:

```bash
npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
teams login
```

::: tip
The Teams CLI is the fastest path from zero to working bot. It handles app registration, bot resource creation, and credential generation in one command.
:::

### Dev Tunnel

Dev tunnels expose your local bot to the internet so Teams can reach it. Install [Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/get-started):

::: code-group
```bash [Windows]
winget install Microsoft.devtunnel
```

```bash [macOS]
brew install --cask devtunnel
```
:::

### Language Runtime

Pick the language you want to work in:

- **.NET**: [.NET 10 SDK](https://dotnet.microsoft.com/download)
- **Node.js**: [Node.js 20+](https://nodejs.org/)
- **Python**: [Python 3.11+](https://www.python.org/downloads/)

::: tip
For Python, we recommend installing [uv](https://docs.astral.sh/uv/) — it simplifies dependency management and can load `.env` files automatically.
:::

---

## Step 1: Set Up a Tunnel

The Bot Framework needs to reach your bot over HTTPS. A dev tunnel exposes your localhost (port `3978`) to the internet.

```bash
# Log in and create a tunnel
devtunnel user login
devtunnel create --allow-anonymous my-bot-tunnel
devtunnel port create -p 3978 my-bot-tunnel
devtunnel host my-bot-tunnel
```

Copy the **HTTPS URL** from the output (e.g., `https://abc123.devtunnels.ms`). You'll use this in the next step.

::: warning Keep the tunnel running
Your tunnel must stay running while you test your bot. If it stops, Teams can't deliver messages and your bot will appear unresponsive.

**Important:** Tunnel URLs change each time you restart. When this happens, update your messaging endpoint (see [Common Gotchas](#common-gotchas)).
:::

---

## Step 2: Create the Teams App

The `teams app create` command registers your bot with Teams and generates credentials:

```bash
teams app create --name "MyBot" --endpoint "https://<tunnel-url>/api/messages" --json
```

Replace `<tunnel-url>` with the HTTPS URL from Step 1.

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

::: tip Save the install link
Keep the `installLink` — you'll use it to add the bot to Teams in Step 4.
:::

---

## Step 3: Save Credentials

Create a `.env` file at the **root of the botas repository** with the credentials from Step 2:

```dotenv
CLIENT_ID=your-application-client-id
CLIENT_SECRET=your-client-secret-value
TENANT_ID=your-directory-tenant-id
PORT=3978
```

::: danger Never commit secrets
The botas `.gitignore` already excludes `.env`, but double-check if you're working in a fork. Never commit credentials to source control.
:::

### .NET-specific setup

.NET samples use `launchSettings.json` for environment variables. A helper script bridges the `.env` file:

::: code-group
```bash [Bash]
node dotnet/env-to-launch-settings.mjs EchoBot
```

```powershell [PowerShell]
node dotnet\env-to-launch-settings.mjs EchoBot
```
:::

This creates `dotnet/samples/EchoBot/Properties/launchSettings.json` from your `.env` file.

::: details Alternative: Manual configuration
If you prefer to configure credentials manually, see the [.NET Azure AD configuration examples](authentication#configure-msal-with-the-azuread-configuration-schema) in the Authentication guide.
:::

---

## Step 4: Run and Test

### Start a sample bot

Pick your language and run the echo bot:

::: code-group
```bash [.NET]
cd dotnet
dotnet run --project samples/EchoBot
```

```bash [Node.js]
cd node
npx tsx --env-file ../.env samples/express/index.ts
```

```bash [Python (uv)]
cd python/samples/echo-bot
uv run --env-file ../../.env main.py
```

```bash [Python (pip)]
cd python/samples/echo-bot
pip install -e .
python main.py
```
:::

You should see output indicating the bot is listening on port `3978`.

### Test in Teams

1. Open the `installLink` from Step 2 in your browser
2. Click **Add** to install the bot
3. Choose where to add it (personal chat, team, or channel)
4. Send a message — you should see your bot reply with an echo

::: tip First message
Try: `Hello bot!`

Expected reply: `You said: Hello bot!`
:::

---

## Common Gotchas

| Problem | Fix |
|---------|-----|
| `401 Unauthorized` on incoming messages | Double-check that `CLIENT_ID` in your `.env` matches the app registration. |
| Bot doesn't respond | Make sure your tunnel is running and the messaging endpoint matches your current tunnel URL. |
| `CLIENT_SECRET` doesn't work | Secrets expire. Regenerate via `teams app secret reset <appId>`, then update `.env`. |
| Tunnel URL changed | Run `teams app edit <appId> --endpoint "https://<new-url>/api/messages"` to update the endpoint. |
| Port conflict on 3978 | Set a different port in `.env` (`PORT=3979`) and update your tunnel: `devtunnel port create -p 3979 my-bot-tunnel`. |

---

## What's Next?

Now that your bot is running:

- **Build something real**: Check out the [Getting Started](getting-started) guide for code examples
- **Add features**: Learn about [Teams Features](teams-features) like mentions, adaptive cards, and typing indicators
- **Understand auth**: Read [How Authentication Works](authentication) for the technical details
- **Go deeper**: Explore language-specific guides for [.NET](languages/dotnet), [Node.js](languages/nodejs), or [Python](languages/python)

---

## Appendix: Manual Setup (Azure Portal)

If you don't have the Teams CLI or prefer manual setup, you can create your app registration and bot resource through the Azure portal.

::: details Azure Portal Setup Steps

### Create an App Registration

1. Sign in to the [Azure portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** → **App registrations** → **New registration**
3. Enter a display name (e.g., `my-botas-bot`) and click **Register**
4. On the overview page, copy:
   - **Application (client) ID** → your `CLIENT_ID`
   - **Directory (tenant) ID** → your `TENANT_ID`

### Create a Client Secret

5. In your app registration, go to **Certificates & secrets** → **New client secret**
6. Add a description (e.g., `dev-secret`), choose an expiry, and click **Add**
7. **Copy the secret Value immediately** → your `CLIENT_SECRET`

::: warning
The secret value is only shown once. If you lose it, create a new one.
:::

### Create the Azure Bot Resource

8. In the Azure portal, search for **Azure Bot** and click **Create**
9. Fill in:
   - **Bot handle** — a unique name
   - **Subscription** and **Resource group** — pick or create
10. Under **Microsoft App ID**, choose **Use existing app registration** and paste your `CLIENT_ID`
11. Click **Review + create** → **Create**
12. Once deployed, open the resource and go to **Configuration**
13. Set **Messaging endpoint** to: `https://<your-tunnel-url>/api/messages`

### Using Azure CLI

If you prefer the command line, the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) can automate app registration and bot resource creation. See the [Azure Bot Service documentation](https://learn.microsoft.com/azure/bot-service/) for `az` commands.

:::
