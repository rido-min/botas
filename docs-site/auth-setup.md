---
outline: deep
---

# Authentication & Setup

## Overview

botas uses a **two-auth model** to keep your bot secure in both directions:

| Direction | What happens | How it works |
|-----------|-------------|--------------|
| **Inbound** | Bot Framework sends an activity to your bot | Your bot validates the JWT bearer token on every `POST /api/messages` request. Invalid tokens are rejected with a `401` before any of your code runs. |
| **Outbound** | Your bot replies to the user | botas acquires an OAuth2 client-credentials token and attaches it to every call to the Bot Framework REST API. Token caching and refresh are handled automatically. |

You don't need to write any auth code yourself — botas handles both sides. You just need to provide three credentials: **CLIENT_ID**, **CLIENT_SECRET**, and **TENANT_ID**.

This guide walks you through getting those credentials and wiring everything up.

---

## Prerequisites

- **Teams CLI** — creates bot registrations and provides credentials instantly:
  ```bash
  npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
  teams login
  ```

- **Dev tunnel** — exposes your local port to the internet. Install [Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/get-started) or [ngrok](https://ngrok.com/).

::: details Prefer Azure Portal instead?
If you don't have the Teams CLI or prefer manual setup, see the [Appendix: Azure Portal Setup](#appendix-azure-portal-setup) section below.
:::

---

## Step 1: Set Up a Tunnel for Local Development

The Bot Framework needs to reach your bot over HTTPS. During local development, a tunnel exposes your localhost to the internet.

### Option A: Dev Tunnels (recommended)

[Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/get-started) is Microsoft's built-in tunneling tool.

```bash
# Install (if you haven't already)
winget install Microsoft.devtunnel   # Windows
brew install --cask devtunnel        # macOS

# Log in and create a persistent tunnel
devtunnel user login
devtunnel create --allow-anonymous
devtunnel port create -p 3978
devtunnel host
```

Copy the HTTPS URL from the output — that's your tunnel URL.

### Option B: ngrok (alternative)

```bash
# Install from https://ngrok.com/download, then:
ngrok http 3978
```

Copy the `Forwarding` HTTPS URL from the ngrok output.

::: warning
Make sure your tunnel is running *before* you test your bot. If the tunnel is down, the Bot Framework can't deliver messages and you'll see silent failures.

Tunnel URLs are ephemeral — they change each time you restart. Update your messaging endpoint when this happens.
:::

---

## Step 2: Create the Teams App and Get Credentials

The `teams app create` command handles app registration and bot resource setup in one step, then returns your credentials.

```bash
teams app create --name "MyBot" --endpoint "https://<tunnel-url>/api/messages" --json
```

The command returns JSON with your credentials:

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

Save these values for the next step.

::: tip
If your tunnel URL changes, update the endpoint with:
```bash
teams app edit <appId> --endpoint "https://<new-url>/api/messages"
```
:::

---

## Step 3: Configure Environment Variables

Create a `.env` file in the root of your project with the credentials from Step 2:

```env
CLIENT_ID=your-application-client-id
CLIENT_SECRET=your-client-secret-value
TENANT_ID=your-directory-tenant-id
PORT=3978
```

All botas samples read from these variables automatically.

::: danger
Never commit your `.env` file to source control. The botas `.gitignore` already excludes it, but double-check if you're working in a fork.
:::

---

## Step 4: Run and Test Your Bot

### Start a sample

Pick the language you're working with:

::: code-group
```bash [.NET]
cd dotnet
dotnet run --project samples/EchoBot
```

```bash [Node.js]
cd node
npx tsx --env-file ../.env samples/express/index.ts
```

```bash [Python (bash)]
cd python/samples/echo-bot
uv run --env-file ../../.env main.py
```

```powershell [Python (PowerShell)]
cd python\samples\echo-bot
uv run --env-file ../../.env main.py
```
:::

::: details No uv? Use pip instead (Python)
```bash
cd python/samples/echo-bot
pip install -e .
python main.py
```
:::

### Test with Web Chat

The quickest way to test is in the Azure portal:

1. Open your **Azure Bot** resource
2. Click **Test in Web Chat** in the left sidebar
3. Type a message — you should see your bot reply

### Test with Bot Framework Emulator

For a richer local testing experience, use the [Bot Framework Emulator](https://github.com/microsoft/BotFramework-Emulator/releases):

1. Download and install the Emulator
2. Click **Open Bot** and enter: `http://localhost:3978/api/messages`
3. Enter your `CLIENT_ID` and `CLIENT_SECRET` in the settings
4. Start chatting with your bot

::: tip
The Emulator connects directly to localhost, so you don't need a tunnel running when using it. However, the Azure portal's Web Chat *does* require the tunnel.
:::

---

## Common Gotchas

| Problem | Fix |
|---------|-----|
| `401 Unauthorized` on incoming messages | Double-check that `CLIENT_ID` in your `.env` matches your app registration. |
| Bot doesn't respond in Web Chat | Make sure your tunnel is running and the messaging endpoint matches your current tunnel URL. |
| `CLIENT_SECRET` doesn't work | Secrets expire. Create a new one if needed, or regenerate via `teams app secret reset <appId>`. |
| Tunnel URL changed | If using Teams CLI, run `teams app edit <appId> --endpoint "https://<new-url>/api/messages"`. For manual setup, update the messaging endpoint in the Azure Bot resource. |
| Port conflict on 3978 | Set a different port in your `.env` (`PORT=3979`) and update your tunnel to forward to that port. |

---

## How Auth Works Under the Hood

You don't need to understand this to use botas, but if you're curious:

**Inbound (JWT validation):**
When the Bot Framework sends a message to your bot, it includes a signed JWT. botas automatically validates this token by fetching signing keys from the Bot Framework's OpenID metadata endpoint, then checking the signature, issuer, and audience (your `CLIENT_ID`). If anything fails, the request is rejected with `401` — your handlers never see it.

**Outbound (client credentials):**
When your bot sends a reply, botas uses your `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` to acquire an OAuth2 token (scope: `https://api.botframework.com/.default`). This token is attached to the outbound API call. The `TokenManager` component handles caching and automatic refresh so you never think about it.

For the full technical details, see the [Architecture guide](https://github.com/rido-min/botas/blob/main/specs/Architecture.md).

---

## Appendix: Azure Portal Setup

If you don't have the Teams CLI available or prefer manual setup, you can create your app registration and bot resource through the Azure portal.

### Create an App Registration

The app registration is how Azure identifies your bot. It provides the credentials botas uses for both inbound and outbound auth.

1. Sign in to the [Azure portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** → **App registrations** → **New registration**
3. Enter a display name (e.g. `my-botas-bot`) and click **Register**
4. On the overview page, copy two values:
   - **Application (client) ID** → this is your `CLIENT_ID`
   - **Directory (tenant) ID** → this is your `TENANT_ID`

#### Create a client secret

5. In your app registration, go to **Certificates & secrets** → **New client secret**
6. Add a description (e.g. `dev-secret`), choose an expiry, and click **Add**
7. **Copy the secret Value immediately** → this is your `CLIENT_SECRET`

::: warning
The secret value is only shown once. If you lose it, you'll need to create a new one.
:::

### Create the Azure Bot Resource

The Azure Bot resource connects your app registration to the Bot Framework channels (Teams, Web Chat, etc.).

1. In the Azure portal, search for **Azure Bot** and click **Create**
2. Fill in the basics:
   - **Bot handle** — a unique name for your bot
   - **Subscription** and **Resource group** — pick existing ones or create new
3. Under **Microsoft App ID**, choose **Use existing app registration** and paste your `CLIENT_ID`
4. Click **Review + create** → **Create**
5. Once deployed, open the resource and go to **Configuration**
6. Set the **Messaging endpoint** to:
   ```
   https://<your-tunnel-url>/api/messages
   ```

::: tip
You can always come back and update the messaging endpoint — you'll need to do this every time your tunnel URL changes.
:::

### Using Azure CLI (alternative)

If you prefer the command line, the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) can automate app registration and bot resource creation. Consult the [Azure Bot Service documentation](https://learn.microsoft.com/en-us/azure/bot-service/) for specific `az` commands.
