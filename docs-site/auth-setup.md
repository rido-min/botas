---
layout: default
title: Authentication & Setup
nav_order: 5
---

# Authentication & Setup
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

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

- An [Azure account](https://azure.microsoft.com/free/) with an active subscription
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) or access to the [Azure portal](https://portal.azure.com)
- A tunneling tool for local development (we'll set this up below)

---

## Step 1: Create an App Registration

The app registration is how Azure identifies your bot. It provides the credentials botas uses for both inbound and outbound auth.

1. Sign in to the [Azure portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** → **App registrations** → **New registration**
3. Enter a display name (e.g. `my-botas-bot`) and click **Register**
4. On the overview page, copy two values:
   - **Application (client) ID** → this is your `CLIENT_ID`
   - **Directory (tenant) ID** → this is your `TENANT_ID`

### Create a client secret

5. In your app registration, go to **Certificates & secrets** → **New client secret**
6. Add a description (e.g. `dev-secret`), choose an expiry, and click **Add**
7. **Copy the secret Value immediately** → this is your `CLIENT_SECRET`

> ⚠️ **Important:** The secret value is only shown once. If you lose it, you'll need to create a new one.

---

## Step 2: Create the Azure Bot Resource

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
   (We'll get this URL in the next step.)

> 💡 **Tip:** You can always come back and update the messaging endpoint — you'll need to do this every time your tunnel URL changes.

---

## Step 3: Set Up a Tunnel for Local Development

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

---

After getting your tunnel URL, go back to your Azure Bot resource → **Configuration** and paste the full messaging endpoint:

```
https://<your-tunnel-url>/api/messages
```

> ⚠️ **Gotcha:** Make sure your tunnel is running *before* you test your bot. If the tunnel is down, the Bot Framework can't deliver messages and you'll see silent failures.

---

## Step 4: Configure Environment Variables

Create a `.env` file in the root of your project with the credentials from Step 1:

```env
CLIENT_ID=your-application-client-id
CLIENT_SECRET=your-client-secret-value
TENANT_ID=your-directory-tenant-id
PORT=3978
```

All botas samples read from these variables automatically.

> 🔒 **Security:** Never commit your `.env` file to source control. The botas `.gitignore` already excludes it, but double-check if you're working in a fork.

---

## Step 5: Run and Test Your Bot

### Start a sample

Pick the language you're working with:

```bash
# .NET
cd dotnet && dotnet run --project samples/EchoBot

# Node.js (Express)
cd node && npx tsx samples/express/index.ts

# Python (FastAPI)
cd python/samples/fastapi && uvicorn main:app --port 3978
```

### Test with Web Chat

The quickest way to test is right in the Azure portal:

1. Open your **Azure Bot** resource
2. Click **Test in Web Chat** in the left sidebar
3. Type a message — you should see your bot reply

### Test with Bot Framework Emulator

For a richer local testing experience, use the [Bot Framework Emulator](https://github.com/microsoft/BotFramework-Emulator/releases):

1. Download and install the Emulator
2. Click **Open Bot** and enter: `http://localhost:3978/api/messages`
3. Enter your `CLIENT_ID` and `CLIENT_SECRET` in the settings
4. Start chatting with your bot

> 💡 **Tip:** The Emulator connects directly to localhost, so you don't need a tunnel running when using it. However, the Azure portal's Web Chat *does* require the tunnel.

---

## Common Gotchas

| Problem | Fix |
|---------|-----|
| `401 Unauthorized` on incoming messages | Double-check that `CLIENT_ID` in your `.env` matches the app registration. Also verify your bot resource is linked to the correct app registration. |
| Bot doesn't respond in Web Chat | Make sure your tunnel is running and the messaging endpoint in the Azure Bot resource matches your current tunnel URL. |
| `CLIENT_SECRET` doesn't work | Secrets expire. Check the expiry date in **Certificates & secrets** and create a new one if needed. Remember to copy the **Value**, not the Secret ID. |
| Tunnel URL changed | Update the **Messaging endpoint** in your Azure Bot resource → **Configuration** every time your tunnel URL changes. |
| Port conflict on 3978 | Set a different port in your `.env` (`PORT=3979`) and update your tunnel to forward to that port. |

---

## How Auth Works Under the Hood

You don't need to understand this to use botas, but if you're curious:

**Inbound (JWT validation):**
When the Bot Framework sends a message to your bot, it includes a signed JWT. botas automatically validates this token by fetching signing keys from the Bot Framework's OpenID metadata endpoint, then checking the signature, issuer, and audience (your `CLIENT_ID`). If anything fails, the request is rejected with `401` — your handlers never see it.

**Outbound (client credentials):**
When your bot sends a reply, botas uses your `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` to acquire an OAuth2 token (scope: `https://api.botframework.com/.default`). This token is attached to the outbound API call. The `TokenManager` component handles caching and automatic refresh so you never think about it.

For the full technical details, see the [Architecture guide](../docs/Architecture.md).
