# Configuration

**Purpose**: Per-language configuration reference for BotAS bots.
**Status**: Draft

---

## Environment Variables

All three languages read the same environment variables.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLIENT_ID` | Yes* | — | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Conditional | — | Azure AD client secret (required for client-credentials flow) |
| `TENANT_ID` | Conditional | — | Azure AD tenant ID (required with `CLIENT_SECRET`) |
| `MANAGED_IDENTITY_CLIENT_ID` | No | — | User-assigned managed identity client ID (for federated auth in Azure) |
| `PORT` | No | `3978` | HTTP listen port |

\* If `CLIENT_ID` is not set, the bot runs without authentication (useful for local development and testing).

> **Security**: Store credentials in a `.env` file at the repo root. The `.gitignore` already excludes it. Never commit secrets to source control.

For instructions on obtaining these values, see [Infrastructure Setup](./setup.md).

---

## Authentication Flows

BotAS selects the authentication flow automatically based on which credentials are provided:

| `CLIENT_ID` | `CLIENT_SECRET` | `MANAGED_IDENTITY_CLIENT_ID` | Flow |
|-------------|-----------------|------------------------------|------|
| not set | — | — | **No auth** (dev/testing only) |
| set | set | — | **Client credentials** (secret) |
| set | not set | — | **User managed identity** |
| set | not set | different value | **Federated identity** (user-assigned MI) |
| set | not set | `"system"` | **Federated identity** (system-assigned MI) |

- **Client credentials**: Uses `CLIENT_ID` + `CLIENT_SECRET` + `TENANT_ID` to acquire OAuth2 tokens from Azure AD.
- **Managed identity**: For bots hosted in Azure. Uses the Azure managed identity matching `CLIENT_ID` — no secret needed.
- **Federated identity**: Exchanges a managed identity token for a client assertion, then acquires a token for the bot's `CLIENT_ID`.

See [Outbound Auth](./outbound-auth.md) for token endpoint details and [Inbound Auth](./inbound-auth.md) for JWT validation.

---

## Per-Language Configuration

### .NET

**Simple API** — `BotApp.Create(args)` reads credentials from the `AzureAd` configuration section (environment variables, `appsettings.json`, CLI args). When `AzureAd:ClientId` is not set, inbound JWT auth is disabled automatically.

**Advanced API** — `AddBotApplication<T>()` registers JWT bearer auth, token acquisition, `HttpClient`, `ConversationClient`, and your bot as a singleton. Use `AddBotApplicationClients(sectionName)` for non-default config sections, or set `AzureAd:AgentScope` to override the default token scope.

### Node.js

**Simple API** — `new BotApp()` auto-detects credentials from environment variables.

**Advanced API** — `new BotApplication(options)` accepts `clientId`, `clientSecret`, `tenantId`, `managedIdentityClientId`, and an optional `token` callback for custom auth. All properties fall back to environment variables.

### Python

**Simple API** — `BotApp()` auto-detects credentials from environment variables.

**Advanced API** — `BotApplication(options=BotApplicationOptions(...))` accepts `client_id`, `client_secret`, `tenant_id`, `managed_identity_client_id`, and an optional `token_factory` callback. All properties fall back to environment variables.

---

## Framework-Specific Auth Wiring

| Framework | Auth helper | What it does |
|-----------|-------------|-------------|
| ASP.NET Core | `AddBotApplication<T>()` | Registers JWT bearer auth scheme via Microsoft.Identity.Web |
| Express | `botAuthExpress()` | Returns Express middleware that validates the JWT header |
| Hono | `botAuthHono()` | Returns Hono middleware that validates the JWT header |
| FastAPI | `bot_auth_dependency()` | Returns a FastAPI `Depends` callable for JWT validation |
| aiohttp | `validate_bot_token(header)` | Async function — call manually in your route handler |

See the [samples](./samples.md) for complete integration examples.

---

## References

- [Infrastructure Setup](./setup.md) — how to register a bot and get credentials
- [Inbound Auth](./inbound-auth.md) — JWT validation details
- [Outbound Auth](./outbound-auth.md) — OAuth2 client credentials flow
- [Architecture](./architecture.md) — overall component design
