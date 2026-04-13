# Configuration

**Purpose**: Per-language configuration reference for BotAS bots.
**Status**: Draft

---

## Environment Variables

All three languages read the same environment variables. These are the primary configuration mechanism.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLIENT_ID` | Yes* | — | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Conditional | — | Azure AD client secret (required for client-credentials flow) |
| `TENANT_ID` | Conditional | — | Azure AD tenant ID (required with `CLIENT_SECRET`) |
| `MANAGED_IDENTITY_CLIENT_ID` | No | — | User-assigned managed identity client ID (for federated auth in Azure) |
| `PORT` | No | `3978` | HTTP listen port |

\* If `CLIENT_ID` is not set, the bot runs without authentication (useful for local development and testing).

> **Security**: Store credentials in a `.env` file at the repo root. The `.gitignore` already excludes it. Never commit secrets to source control.

For instructions on obtaining these values, see [Infrastructure Setup](./Setup.md).

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

- **Client credentials**: The standard flow. Uses `CLIENT_ID` + `CLIENT_SECRET` + `TENANT_ID` to acquire OAuth2 tokens from Azure AD.
- **Managed identity**: For bots hosted in Azure. Uses the Azure managed identity matching `CLIENT_ID` — no secret needed.
- **Federated identity**: Exchanges a managed identity token for a client assertion, then acquires a token for the bot's `CLIENT_ID`. Set `MANAGED_IDENTITY_CLIENT_ID` to the MI's client ID (or `"system"` for system-assigned).

See [Outbound Auth](./outbound-auth.md) for token endpoint details and [Inbound Auth](./inbound-auth.md) for JWT validation.

---

## .NET Configuration

### Simple API: `BotApp.Create()`

The simplest way to run a .NET bot. Reads credentials from the `AzureAd` configuration section (which includes environment variables, `appsettings.json`, and command-line args via ASP.NET Core's configuration system).

```csharp
var app = BotApp.Create(args);
app.On("message", async (ctx, ct) =>
    await ctx.SendAsync($"Echo: {ctx.Activity.Text}", ct));
app.Run();
```

**How credentials map**:

BotAS reads `AzureAd:ClientId`, `AzureAd:ClientSecret`, and `AzureAd:TenantId` from ASP.NET Core configuration. The standard `CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID` environment variables are mapped via `appsettings.json` or configuration providers.

Example `appsettings.json`:
```json
{
  "AzureAd": {
    "ClientId": "${CLIENT_ID}",
    "ClientSecret": "${CLIENT_SECRET}",
    "TenantId": "${TENANT_ID}"
  }
}
```

> When `AzureAd:ClientId` is not set, `BotApp` disables inbound JWT auth automatically — matching the no-auth dev mode of Node.js and Python.

### Advanced API: Manual ASP.NET Core Hosting

For full control over DI, middleware, routes, and server lifecycle:

```csharp
WebApplicationBuilder builder = WebApplication.CreateSlimBuilder(args);
builder.Services.AddBotApplication<BotApplication>();
WebApplication webApp = builder.Build();
var bot = webApp.UseBotApplication<BotApplication>();

bot.On("message", async (ctx, ct) =>
    await ctx.SendAsync($"Echo: {ctx.Activity.Text}", ct));

webApp.Run();
```

**DI registration**: `AddBotApplication<TApp>()` registers:
- JWT bearer authentication (via Microsoft.Identity.Web)
- `TokenAcquisition` for outbound OAuth tokens
- An `HttpClient` named `"BotFrameworkConversation"` with automatic token attachment
- A keyed `ConversationClient` scoped to `"AzureAd"`
- Your `TApp` as a singleton

**Custom configuration section**: Pass a different section name to `AddBotApplicationClients(sectionName)` if you need multiple bot identities or non-default config sections.

**Custom token scope**: Set `AzureAd:AgentScope` in configuration to override the default `https://api.botframework.com/.default` scope.

---

## Node.js Configuration

### Simple API: `BotApp` (botas-express)

```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()
app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})
app.start()
```

Credentials are auto-detected from environment variables.

### Advanced API: `BotApplication`

```typescript
import { BotApplication } from 'botas'

const bot = new BotApplication({
  clientId: 'your-app-id',
  clientSecret: 'your-secret',
  tenantId: 'your-tenant-id',
})
```

#### `BotApplicationOptions`

| Property | Type | Env fallback | Description |
|----------|------|-------------|-------------|
| `clientId` | `string` | `CLIENT_ID` | Azure AD application ID |
| `clientSecret` | `string` | `CLIENT_SECRET` | Client secret |
| `tenantId` | `string` | `TENANT_ID` | Tenant ID |
| `managedIdentityClientId` | `string \| "system"` | `MANAGED_IDENTITY_CLIENT_ID` | Managed identity client ID |
| `token` | `(scope, tenantId) => Promise<string>` | — | Custom token factory (overrides all other auth) |

All properties fall back to their corresponding environment variable when not set explicitly.

#### Custom token factory

For testing or custom auth scenarios, provide a `token` callback:

```typescript
const bot = new BotApplication({
  clientId: 'your-app-id',
  token: async (scope, tenantId) => {
    return await myCustomTokenProvider.getToken(scope)
  },
})
```

---

## Python Configuration

### Simple API: `BotApp`

```python
from botas import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

Credentials are auto-detected from environment variables.

### Advanced API: `BotApplication`

```python
from botas import BotApplication
from botas.token_manager import BotApplicationOptions

bot = BotApplication(options=BotApplicationOptions(
    client_id="your-app-id",
    client_secret="your-secret",
    tenant_id="your-tenant-id",
))
```

#### `BotApplicationOptions`

| Property | Type | Env fallback | Description |
|----------|------|-------------|-------------|
| `client_id` | `str \| None` | `CLIENT_ID` | Azure AD application ID |
| `client_secret` | `str \| None` | `CLIENT_SECRET` | Client secret |
| `tenant_id` | `str \| None` | `TENANT_ID` | Tenant ID |
| `managed_identity_client_id` | `str \| None` | `MANAGED_IDENTITY_CLIENT_ID` | Managed identity client ID |
| `token_factory` | `Callable[[str, str], Awaitable[str]] \| None` | — | Custom token factory |

All properties fall back to their corresponding environment variable when not set explicitly.

#### Custom token factory

```python
async def my_token_provider(scope: str, tenant_id: str) -> str:
    return await custom_auth.get_token(scope)

bot = BotApplication(options=BotApplicationOptions(
    client_id="your-app-id",
    token_factory=my_token_provider,
))
```

---

## Framework-Specific Auth Wiring

Each web framework needs its own auth integration. BotAS provides helpers:

| Framework | Auth helper | What it does |
|-----------|-------------|-------------|
| ASP.NET Core | `AddBotApplication<T>()` | Registers JWT bearer auth scheme via Microsoft.Identity.Web |
| Express | `botAuthExpress()` | Returns Express middleware that validates the JWT header |
| Hono | `botAuthHono()` | Returns Hono middleware that validates the JWT header |
| FastAPI | `bot_auth_dependency()` | Returns a FastAPI `Depends` callable for JWT validation |
| aiohttp | `validate_bot_token(header)` | Async function — call manually in your route handler |

See the [samples](./Samples.md) for complete integration examples.

---

## References

- [Infrastructure Setup](./Setup.md) — how to register a bot and get credentials
- [Inbound Auth](./inbound-auth.md) — JWT validation details
- [Outbound Auth](./outbound-auth.md) — OAuth2 client credentials flow
- [Architecture](./Architecture.md) — overall component design
