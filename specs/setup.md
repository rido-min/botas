# Bot Registration Setup

This guide walks through registering a bot and obtaining the credentials needed to run BotAS samples. After completing it you will have `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` values ready to use.

> **Scope**: This guide covers bot *infrastructure* only (app registration, Bot Framework channel registration). It does not cover hosting or deploying your bot code.

---

## Prerequisites

### 1. Install the Teams CLI

```bash
npm install -g @microsoft/teams.cli@preview
```

Verify:

```bash
teams --version
```

### 2. Authenticate

```bash
teams login
```

Confirm with `teams status` — you should see your authenticated account.

### 3. Expose your bot endpoint

Your bot must be reachable from the internet before you register it. For local development, use a tunneling tool:

- **Microsoft devtunnels:** [Get started with devtunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/get-started?tabs=windows)

BotAS samples listen on port `3978` by default, so your endpoint will look like:

```
https://<your-tunnel>/api/messages
```

---

## Create the bot

A single command creates the app registration, bot channel, and client secret:

```bash
teams app create --name "MyBot" --endpoint "https://<your-tunnel>/api/messages" --json
```

The JSON output contains everything you need:

```json
{
  "appName": "MyBot",
  "teamsAppId": "...",
  "botId": "...",
  "endpoint": "https://<your-tunnel>/api/messages",
  "installLink": "https://teams.microsoft.com/l/app/...",
  "credentials": {
    "CLIENT_ID": "...",
    "CLIENT_SECRET": "...",
    "TENANT_ID": "..."
  }
}
```

Save the `teamsAppId` — you will need it for endpoint updates and verification.

---

## Configure your environment

Copy the credentials from the JSON output into your `.env` file at the repo root:

```
CLIENT_ID=<credentials.CLIENT_ID>
CLIENT_SECRET=<credentials.CLIENT_SECRET>
TENANT_ID=<credentials.TENANT_ID>
PORT=3978
```

> **Security**: Never commit `.env` to source control. The repo's `.gitignore` already excludes it.

---

## Install in Teams

Open the `installLink` from the creation output in your browser to install the bot in Microsoft Teams. You can install it for personal use, in a team, or in a group chat.

> **Note**: If installation fails with a permissions error, your tenant administrator may need to [enable custom app upload (sideloading)](https://learn.microsoft.com/microsoftteams/platform/concepts/build-and-test/prepare-your-o365-tenant#enable-custom-teams-apps-and-configure-custom-app-upload-settings).

---

## Verify the setup

Confirm the app was created:

```bash
teams app view <teamsAppId> --json
```

Then start any sample and send a message through Teams:

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

Each time your tunnel URL changes (new devtunnels session), update the registered endpoint:

```bash
teams app edit <teamsAppId> --endpoint "https://<new-tunnel>/api/messages"
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `AUTH_REQUIRED` or `Not logged in` | Run `teams login`, then retry |
| `AUTH_TOKEN_FAILED` | Run `teams login` to refresh tokens, then retry |
| Sideloading / custom apps blocked | Ask your tenant admin to enable custom app upload ([docs](https://learn.microsoft.com/microsoftteams/platform/concepts/build-and-test/prepare-your-o365-tenant#enable-custom-teams-apps-and-configure-custom-app-upload-settings)) |

---

## CLI reference

| Command | Description |
|---------|-------------|
| `teams app create --name X --endpoint Y --json` | Create bot + app registration |
| `teams app view <appId> --json` | View app details |
| `teams app edit <appId> --endpoint <url>` | Update messaging endpoint |
| `teams app list` | List all your Teams apps |
| `teams self-update` | Update the Teams CLI |
