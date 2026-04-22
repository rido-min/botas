---
outline: deep
---

# How Authentication Works

botas handles bot authentication automatically using a **two-auth model**. You don't need to write any auth code — just provide three credentials (`CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`) and botas takes care of the rest.

This guide explains how authentication works under the hood. If you just want to get credentials and start coding, see the [Setup Guide](setup).

---

## The Two-Auth Model

Every Teams bot needs to authenticate in both directions:

| Direction | What happens | How it works |
|-----------|-------------|--------------|
| **Inbound** | Bot Framework sends an activity to your bot | Your bot validates the JWT bearer token on every `POST /api/messages` request. Invalid tokens are rejected with a `401` before any of your code runs. |
| **Outbound** | Your bot replies to the user | botas acquires an OAuth2 client-credentials token and attaches it to every call to the Bot Framework REST API. Token caching and refresh are handled automatically. |

This two-way security model ensures:
- Only the Bot Framework can send activities to your bot (inbound JWT validation)
- Only your bot can send messages on behalf of your app (outbound client credentials)

---

## How Inbound Auth Works (JWT Validation)

When the Bot Framework sends a message to your bot, it includes a **signed JWT** (JSON Web Token) in the `Authorization` header.

botas automatically:

1. **Fetches signing keys** from the Bot Framework's OpenID metadata endpoint (`https://login.botframework.com/v1/.well-known/openidconfiguration`)
2. **Verifies the JWT signature** using those keys
3. **Checks the token claims**:
   - `aud` (audience) must match your `CLIENT_ID`
   - `iss` (issuer) must be `https://api.botframework.com`
   - `exp` (expiry) must be in the future

If **any** of these checks fail, the request is rejected with `401 Unauthorized` before your handlers ever see it.

::: tip You never see invalid requests
botas middleware runs before your code. If JWT validation fails, your handlers are never called — the request is rejected immediately.
:::

---

## How Outbound Auth Works (Client Credentials)

When your bot sends a reply, botas needs to prove to the Bot Framework API that the request is authorized.

botas automatically:

1. **Acquires an OAuth2 token** using the [client credentials flow](https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow)
   - **Scope**: `https://api.botframework.com/.default`
   - **Credentials**: Your `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID`
2. **Caches the token** in memory until it expires
3. **Attaches the token** to every outbound API call (`Authorization: Bearer <token>`)
4. **Automatically refreshes** when the token expires

The `TokenManager` component handles this entire flow. You never interact with it directly.

---

## .NET Azure AD Configuration

.NET samples use the **Microsoft.Identity.Web** library for OAuth2 token acquisition. You can configure credentials in `appsettings.json` or override with environment variables in `launchSettings.json`.

### Configure MSAL with the `AzureAd` configuration schema

::: code-group
```json [appsettings.json]
{
  "$schema": "https://json.schemastore.org/appsettings.json",
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "<your-tenant-id>",
    "ClientId": "<your-bot-app-id>",
    "ClientCredentials": [
      {
        "SourceType": "ClientSecret",
        "ClientSecret": "<your-client-secret>"
      }
    ]
  }
}
```

```json [launchSettings.json]
{
  "$schema": "https://json.schemastore.org/launchsettings.json",
  "profiles": {
    "local": {
      "commandName": "Project",
      "launchBrowser": false,
      "applicationUrl": "http://localhost:3978",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development",
        "AzureAd__Instance": "https://login.microsoftonline.com/",
        "AzureAd__TenantId": "<your-tenant-id>",
        "AzureAd__ClientId": "<your-bot-app-id>",
        "AzureAd__ClientCredentials__0__SourceType": "ClientSecret",
        "AzureAd__ClientCredentials__0__ClientSecret": "<your-client-secret>"
      }
    }
  }
}
```

```dotenv [.env]
AzureAd__Instance=https://login.microsoftonline.com/
AzureAd__ClientId="<your-bot-app-id>"
AzureAd__TenantId="<your-tenant-id>"
AzureAd__ClientCredentials__0__SourceType="ClientSecret"
AzureAd__ClientCredentials__0__ClientSecret="<your-client-secret>"
```
:::

The [env-to-launch-settings.mjs](https://github.com/rido-min/botas/blob/main/dotnet/env-to-launch-settings.mjs) helper script converts a `.env` file to `launchSettings.json` format automatically.

---

## Troubleshooting Auth Failures

### `401 Unauthorized` on incoming messages

**Cause**: JWT validation failed. Most commonly, the `CLIENT_ID` in your `.env` doesn't match the app registration.

**Fix**:
1. Verify `CLIENT_ID` matches the **Application (client) ID** from your app registration
2. Check that your bot's messaging endpoint is configured correctly
3. Ensure your tunnel is running and the URL hasn't changed

### `403 Forbidden` on outbound replies

**Cause**: Token acquisition failed or the token was rejected by the Bot Framework API.

**Fix**:
1. Verify `CLIENT_SECRET` is correct and hasn't expired
2. Regenerate the secret if needed: `teams app secret reset <appId>`
3. Update your `.env` with the new secret and restart your bot

### Bot doesn't respond at all

**Cause**: The Bot Framework can't reach your bot's messaging endpoint.

**Fix**:
1. Check that your dev tunnel is running
2. Verify the messaging endpoint URL is correct (should end with `/api/messages`)
3. Test your tunnel: `curl https://<tunnel-url>/api/messages` should return a response (even if it's an error)

---

## Learn More

- **Setup walkthrough**: [Setup Guide](setup) — step-by-step instructions from zero to working bot
- **Code examples**: [Getting Started](getting-started) — echo bots in all three languages
- **Architecture details**: [specs/architecture.md](https://github.com/rido-min/botas/blob/main/specs/architecture.md) — technical design and component diagram
- **OAuth2 flows**: [Microsoft identity platform docs](https://learn.microsoft.com/azure/active-directory/develop/) — deep dive on Azure AD authentication
