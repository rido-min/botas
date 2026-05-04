# Outbound Authentication Spec

**Purpose**: Define how bots authenticate outbound requests to the Bot Service Service.
**Status**: Draft

---

## Overview

When a bot sends an activity to the Bot Service (e.g., replying to a user), the HTTP request MUST include a bearer token obtained via the OAuth 2.0 client credentials flow. This token proves the bot's identity to the Bot Service Service.

---

## Token Acquisition

### Grant Type

OAuth 2.0 **client credentials** grant (`grant_type=client_credentials`).

### Token Endpoint

```
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
```

Where `{tenantId}` is the bot's Azure AD tenant ID. Each implementation resolves it from a different source when `TENANT_ID` is not set:

| Language | Source of `TENANT_ID` | Default when unset |
|----------|------------------------|---------------------|
| .NET | `AzureAd:TenantId` via `IConfiguration` (Microsoft.Identity.Web). Outbound calls in `BotAuthenticationHandler` use the `common` authority for the token endpoint span/log. | `common` (used by Microsoft.Identity.Web defaults) |
| Node.js | `clientSecret`/`tenantId` option, falling back to `TENANT_ID` env var. `TokenManager.getBotToken()` substitutes `botframework.com` when no tenant is set. | `botframework.com` |
| Python | `tenant_id` option, falling back to `TENANT_ID` env var. The MSAL client-credentials path requires `tenant_id` to be set; if missing, `_do_get_token` returns `None` (and the OTel span uses `common` as a placeholder). | `None` (no token acquired); span placeholder is `common` |

> Implementations are not required to share the same default-tenant value. Choose what is correct for your hosting model and explicitly set `TENANT_ID` in production.

### Request Parameters

| Parameter | Value |
|-----------|-------|
| `grant_type` | `client_credentials` |
| `client_id` | Bot's Azure AD App ID (`CLIENT_ID` env var) |
| `client_secret` | Bot's Azure AD client secret (`CLIENT_SECRET` env var) |
| `scope` | `https://api.botframework.com/.default` |

### Example Request

```http
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&scope=https://api.botframework.com/.default
```

### Example Response

```json
{
  "token_type": "Bearer",
  "expires_in": 3599,
  "access_token": "eyJ0eXAiOi..."
}
```

---

## Token Usage

Every outbound HTTP request to the Bot Service MUST include the token:

```
Authorization: Bearer {access_token}
```

This applies to all outbound calls, including:

- Sending activities (`POST {serviceUrl}v3/conversations/{conversationId}/activities`)
- Any future Bot Service REST API calls

---

## Token Caching

Implementations MUST cache the access token and reuse it until it expires. Best practices:

1. Cache the token along with its `expires_in` value.
2. Refresh the token **before** it expires (e.g., with a small buffer of 60–300 seconds).
3. Handle token refresh failures gracefully — retry or propagate the error.

Implementations SHOULD NOT request a new token for every outbound call.

In practice, .NET delegates caching to MSAL via `IAuthorizationHeaderProvider` (`dotnet/src/Botas/BotAuthenticationHandler.cs`), Node.js delegates to `@azure/msal-node` (`node/packages/botas-core/src/token-manager.ts`), and Python delegates to `msal.ConfidentialClientApplication` (`python/packages/botas/src/botas/token_manager.py`). All three rely on MSAL's in-process token cache.

### Negative Caching

Implementations SHOULD cache failed token acquisition attempts for a short period (e.g., 30 seconds) to avoid hammering the Azure AD token endpoint during transient failures. After the negative cache expires, the next outbound request should retry token acquisition.

**Behavior on negative cache hit**: When a subsequent token request hits the negative cache, the implementation MUST throw/raise an error (not silently return null). This ensures callers are aware of the authentication failure rather than sending unauthenticated requests.

**Implementation status**:
- **Node.js**: Implements a 30 s negative cache and additionally **deduplicates concurrent in-flight token requests** via a single `pendingTokenRequest` promise (see `token-manager.ts` lines 58–149).
- **Python**: No negative cache or in-flight dedup. Each call goes through MSAL, which has its own internal caching.
- **.NET**: No explicit negative cache. MSAL's internal retry/throttle behaviour applies.

---

## Alternative Authentication Flows

Beyond client credentials with a secret, implementations MAY support additional Azure AD authentication flows:

| Flow | When to use | Required config | .NET | Node.js | Python |
|------|-------------|-----------------|------|---------|--------|
| **Client credentials** (secret) | Standard bots with a client secret | `CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID` | ✅ | ✅ | ✅ |
| **User managed identity** | Bots hosted in Azure (no secret needed) | `CLIENT_ID` (matches the managed identity) | Via Microsoft.Identity.Web | ✅ | ❌ |
| **Federated identity** (user-assigned MI) | Bot's `CLIENT_ID` differs from the managed identity | `CLIENT_ID`, `MANAGED_IDENTITY_CLIENT_ID` | Via Microsoft.Identity.Web | ✅ | ❌ |
| **Federated identity** (system-assigned MI) | Uses the VM/container's system-assigned MI | `CLIENT_ID`, `MANAGED_IDENTITY_CLIENT_ID="system"` | Via Microsoft.Identity.Web | ✅ | ❌ |
| **Custom token factory** | Testing or custom auth scenarios | `CLIENT_ID`, custom callback | ✅ | ✅ | ✅ |

> **Python gap**: Only client credentials and the custom `token_factory` are wired up in `python/packages/botas/src/botas/token_manager.py`. The `managed_identity_client_id` option is read from env/options but is not currently used to acquire tokens. Use `token_factory` to plug in `azure-identity` if you need managed identity from Python today.

Flow selection logic:

1. If a custom token factory/callback is provided → use it.
2. If `CLIENT_SECRET` is set → client credentials flow.
3. If `MANAGED_IDENTITY_CLIENT_ID` is set and differs from `CLIENT_ID` → federated identity.
4. If `CLIENT_ID` is set (no secret, no MI override) → user managed identity.
5. If nothing is set → no auth (dev/testing mode).

### Token Factory Callback Signature

The custom token factory receives `scope` and `tenantId` parameters and returns a bearer token string:

| Language | Signature |
|----------|-----------|
| .NET | `Func<string, string, Task<string>>` — `(scope, tenantId) => token` |
| Node.js | `(scope: string, tenantId: string) => Promise<string>` |
| Python | `Callable[[str, str], Awaitable[str]]` — `(scope, tenant_id) → token` |

This allows callers to provide tokens from external sources (managed identity wrappers, test fixtures, custom auth providers) while giving the factory enough context to request the right token.

The token factory SHOULD throw/raise on failure rather than returning `null`, `None`, or an empty string. Implementations MUST propagate factory exceptions to the caller without swallowing them.

> **Current behaviour**: Node.js and Python do not validate the value returned by a custom factory — an empty string or `None` will be passed through and used as the bearer token, which will cause the downstream HTTP call to fail with `401`. Treat the "non-empty" rule as a contract callers are expected to honour, not a runtime invariant. See `node/packages/botas-core/src/token-manager.ts` (lines 130–134) and `python/packages/botas/src/botas/token_manager.py` (`_do_get_token`).

Implementations SHOULD use established identity libraries (e.g., MSAL) rather than making raw HTTP requests to the token endpoint. These libraries handle token caching, retry logic, authority discovery, and edge cases that are difficult to implement correctly from scratch.

See [Configuration](./configuration.md) for the full per-language configuration reference.

---

## Configuration

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID |
| `MANAGED_IDENTITY_CLIENT_ID` | User-assigned managed identity client ID, or `"system"` for system-assigned MI |

`CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` are required for client credentials authentication. See [Alternative Authentication Flows](#alternative-authentication-flows) for other combinations.

---

## References

- [Protocol Spec](./protocol.md) — overall HTTP contract
- [Microsoft Identity Platform Client Credentials Flow](https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow)
- [Bot Service Authentication](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-authentication)
