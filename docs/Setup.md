# Infrastructure Setup

This guide walks through registering a Teams bot and obtaining credentials using the Teams CLI. After completing it you will have `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` values ready to use with any BotAS sample.

> **Scope**: This guide covers bot *infrastructure* only (Azure AD app registration, Teams app manifest). It does not cover hosting or deploying your bot code.

---

## Prerequisites

### 1. Install the Teams CLI

```bash
npm install -g https://github.com/heyitsaamir/teamscli/releases/latest/download/teamscli.tgz
```

Verify:

```bash
teams --version
```

### 2. Authenticate

```bash
teams login
```

Confirm you are authenticated:

```bash
teams status
```

### 3. Expose your bot endpoint

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

## Create the bot

Run the creation command with your bot name and endpoint:

```bash
teams app create --name "MyBot" --endpoint "https://<your-tunnel>/api/messages" --json
```

The command returns JSON similar to:

```json
{
  "appName": "MyBot",
  "teamsAppId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "botId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "endpoint": "https://<your-tunnel>/api/messages",
  "installLink": "https://teams.microsoft.com/l/app/...",
  "credentials": {
    "CLIENT_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "CLIENT_SECRET": "your-secret-value",
    "TENANT_ID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

---

## Configure your environment

Copy the credentials into your `.env` file at the repo root:

```
CLIENT_ID=<value from JSON>
CLIENT_SECRET=<value from JSON>
TENANT_ID=<value from JSON>
PORT=3978
```

> **Security**: Never commit `.env` to source control. The repo's `.gitignore` already excludes it.

---

## Install the bot in Teams

Open the `installLink` from the JSON output in your browser. You can install the bot for:

- **Personal use** — chat 1-on-1 with the bot
- **A team** — add the bot to a team channel
- **A group chat** — add the bot to an existing chat

---

## Verify the registration

Confirm the app was created correctly using the `teamsAppId` from the JSON output:

```bash
teams app view <teamsAppId> --json
```

The response should show your bot name, endpoint, and matching IDs.

---

## Update the endpoint

Each time your tunnel URL changes (new ngrok or devtunnels session), update the registered endpoint:

```bash
teams app edit <teamsAppId> --endpoint "https://<new-tunnel>/api/messages"
```

---

## Common errors

### `AUTH_REQUIRED` or `Not logged in`

Run `teams login` and retry.

### `AUTH_TOKEN_FAILED`

Token expired. Run `teams login` again to refresh, then retry.

### Install link shows "Permission denied" or "Custom apps are blocked"

Sideloading is disabled in your tenant. Ask your Teams admin to enable **"Allow interaction with custom apps"** in the Teams Admin Center:
[Enable custom Teams apps](https://learn.microsoft.com/microsoftteams/platform/concepts/build-and-test/prepare-your-o365-tenant#enable-custom-teams-apps-and-configure-custom-app-upload-settings)

---

## Next steps

With credentials in `.env`, start any sample:

```bash
# .NET
cd dotnet && dotnet run --project samples/EchoBot

# Node (Express)
cd node && npx tsx samples/express/index.ts

# Python (FastAPI)
cd python/packages/botas && uvicorn samples.fastapi.main:app --port 3978
```

Then send a message to your bot in Teams.
