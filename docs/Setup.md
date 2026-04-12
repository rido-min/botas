# Bot Registration Setup

This guide walks through registering a bot in the Azure portal and obtaining the credentials needed to run BotAS samples. After completing it you will have `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` values ready to use.

> **Scope**: This guide covers bot *infrastructure* only (Azure AD app registration, Bot Framework channel registration). It does not cover hosting or deploying your bot code.

---

## Prerequisites

### 1. Azure subscription

You need an active Azure subscription. Sign in at [portal.azure.com](https://portal.azure.com).

### 2. Expose your bot endpoint

Your bot must be reachable from the internet before you register it. For local development, use a tunneling tool:

**Microsoft devtunnels (recommended):**
See [Get started with devtunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/get-started?tabs=windows)

**ngrok (alternative):**
See [ngrok quickstart](https://ngrok.com/docs/getting-started/)

BotAS samples listen on port `3978` by default, so your endpoint will look like:

```
https://<your-tunnel>/api/messages
```

---

## Create the app registration

1. In the Azure portal, navigate to **Microsoft Entra ID** → **App registrations** → **New registration**
2. Enter a name (e.g. `MyBot`) and click **Register**
3. Note the **Application (client) ID** — this is your `CLIENT_ID`
4. Note the **Directory (tenant) ID** — this is your `TENANT_ID`

### Create a client secret

1. In your app registration, go to **Certificates & secrets** → **New client secret**
2. Choose a description and expiry, then click **Add**
3. Copy the **Value** immediately — this is your `CLIENT_SECRET` (it will not be shown again)

---

## Register the bot channel

1. In the Azure portal, search for **Azure Bot** and click **Create**
2. Set **Bot handle** to a unique name, select your subscription and resource group
3. Under **Microsoft App ID**, choose **Use existing app registration** and enter your `CLIENT_ID`
4. Click **Review + create** → **Create**
5. Once deployed, go to the resource → **Configuration** and set the **Messaging endpoint** to your tunnel URL:
   ```
   https://<your-tunnel>/api/messages
   ```

---

## Configure your environment

Copy the credentials into your `.env` file at the repo root:

```
CLIENT_ID=<Application (client) ID>
CLIENT_SECRET=<client secret value>
TENANT_ID=<Directory (tenant) ID>
PORT=3978
```

> **Security**: Never commit `.env` to source control. The repo's `.gitignore` already excludes it.

---

## Verify the setup

Start any sample and send a message using the **Test in Web Chat** feature in the Azure Bot resource:

```bash
# .NET
cd dotnet && dotnet run --project samples/EchoBot

# Node (Express)
cd node && npx tsx samples/express/index.ts

# Python (FastAPI)
cd python/packages/botas && uvicorn samples.fastapi.main:app --port 3978
```

---

## Update the endpoint

Each time your tunnel URL changes (new ngrok or devtunnels session), update the registered endpoint in the Azure portal under your Azure Bot resource → **Configuration** → **Messaging endpoint**.
