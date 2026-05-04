# Inbound Authentication Spec

**Purpose**: Define how bots validate incoming requests from the Bot Service Service.
**Status**: Draft

---

## Overview

Every `POST /api/messages` request from the Bot Service Service carries a JWT bearer token in the `Authorization` header. The bot MUST validate this token **before** processing the activity. An invalid or missing token MUST result in a `401 Unauthorized` response.

---

## Token Location

```
Authorization: Bearer {jwt-token}
```

The token is a standard JSON Web Token (JWT) signed by Microsoft identity platform keys.

---

## Validation Requirements

### 1. Audience (`aud`)

The token's `aud` claim MUST match one of the following:

| Audience format | Example |
|-----------------|---------|
| Bot's Client ID (plain) | `{CLIENT_ID}` |
| Bot's Client ID with `api://` prefix | `api://{CLIENT_ID}` |
| Bot Service global issuer | `https://api.botframework.com` |

The Client ID is read from the `CLIENT_ID` environment variable.

### 2. Issuer (`iss`)

The following issuers MUST be accepted:

| Issuer | When used |
|--------|-----------|
| `https://api.botframework.com` | Tokens from the global Bot Service channel |
| `https://sts.windows.net/{tenantId}/` | Tokens from Azure AD v1 endpoints |
| `https://login.microsoftonline.com/{tenantId}/v2` | Tokens from Azure AD v2 endpoints |
| `https://login.microsoftonline.com/{tenantId}/v2.0` | Tokens from Azure AD v2 endpoints (alternate format) |

Where `{tenantId}` is the Azure AD tenant ID from the token's `tid` claim.

> **.NET gap**: The current .NET implementation (`JwtExtensions.AddCustomJwtBearer` and `AddCustomJwtBearerEx`) only registers `https://login.microsoftonline.com/{tenantId}/v2` in `ValidIssuers` — it does **not** include the `v2.0` variant. Node.js and Python validate all four issuers above. See the [parity table](#cross-language-auth-parity) below.

### 3. Signature (JWKS)

Token signatures MUST be verified against public keys retrieved from the appropriate OpenID configuration endpoint (see below). Implementations MUST restrict accepted algorithms to **RS256** only. This prevents algorithm confusion attacks where an attacker could force the use of a weaker or symmetric algorithm.

### 4. Expiration

Standard JWT `exp` / `nbf` claims MUST be enforced. Expired tokens MUST be rejected.

---

## OpenID Configuration Discovery

The OpenID configuration URL is selected dynamically by inspecting the **`iss` claim** of the incoming token before full validation:

| Condition | OpenID Configuration URL |
|-----------|--------------------------|
| `iss == "https://api.botframework.com"` | `https://login.botframework.com/v1/.well-known/openid-configuration` |
| Any other issuer | `https://login.microsoftonline.com/{tid}/v2.0/.well-known/openid-configuration` |

Where `{tid}` is the token's `tid` claim.

### Discovery Flow

```
1. Decode JWT header + payload (without verifying signature yet)
2. Read `iss` claim
3. Select OpenID configuration URL based on `iss`
4. Fetch OpenID configuration → extract `jwks_uri`
5. Fetch JWKS → find signing key matching token's `kid` header
6. Validate signature, audience, issuer, and expiration
```

### Key Caching

Implementations MUST cache the JWKS keys and OpenID configuration to avoid fetching on every request. A reasonable cache duration is 24 hours, with a fallback re-fetch on key-not-found errors. The cache MUST be shared across all validation calls — i.e., module-level or singleton-scoped. Creating a new validator instance per request defeats caching and causes a network fetch on every inbound activity.

> **Serverless environments**: In serverless environments where singleton state is not guaranteed across invocations, implementations SHOULD use the platform's built-in caching mechanism (e.g., external cache, warm instance reuse) to minimize JWKS fetches. The intent is to avoid per-request network fetches — the specific caching strategy may vary by hosting model.

**Key rollover retry**: When a token's `kid` does not match any cached key, implementations MUST force a JWKS refresh and retry validation **once**. If the key is still not found after refresh, reject the token. This handles Azure AD key rotations gracefully without requiring manual cache invalidation.

### Metadata URL Validation

Before fetching an OpenID configuration URL, implementations MUST validate that the URL starts with one of these trusted prefixes:

- `https://login.botframework.com/`
- `https://login.microsoftonline.com/`

This prevents SSRF attacks where a crafted token could point the bot to an attacker-controlled metadata endpoint.

### Rate Limiting Failed Validations

Implementations SHOULD cache recently-failed tokens (by hash) for a short cooldown period (e.g., 5 seconds) to prevent repeated validation attempts for the same invalid token. This mitigates denial-of-service attacks that exploit expensive JWKS fetches and crypto operations.

---

## Error Responses

| Condition | HTTP Status |
|-----------|-------------|
| Missing `Authorization` header | `401` |
| Invalid or expired token | `401` |
| Wrong audience | `401` |
| Unknown issuer | `401` |
| Signature verification failure | `401` |

The response body is implementation-defined but SHOULD NOT leak internal details.

---

## Cross-Language Auth Parity

All language implementations MUST support the same authentication features. This table tracks which features are required and their implementation status:

| Feature | Required | .NET | Node.js | Python |
|---------|----------|------|---------|--------|
| JWT signature verification (JWKS) | ✅ | MSAL + middleware | `jose` library | `PyJWT` + `httpx` |
| Audience validation (3 formats) | ✅ | ✅ | ✅ | ✅ |
| Issuer validation (`sts.windows.net` + `login.microsoftonline.com/.../v2`) | ✅ | ✅ | ✅ | ✅ |
| Issuer validation (`login.microsoftonline.com/.../v2.0`) | ✅ | ❌ (see [.NET gap](#2-issuer-iss)) | ✅ | ✅ |
| Dynamic metadata URL selection by `iss` | ✅ | ✅ | ✅ | ✅ |
| Metadata URL prefix validation (SSRF defense) | ✅ | ✅ | ✅ | ✅ |
| JWKS caching keyed by metadata URL | ✅ | Via MSAL `ConfigurationManager` | Module-level `Map`, 24 h TTL, 50-entry cap | Module-level `dict` guarded by `asyncio.Lock` |
| `kid`-miss JWKS refresh (key rollover) | ✅ | Via MSAL | Built into `jose` `createRemoteJWKSet` | Explicit `force_refresh=True` retry once |
| Token expiration (`exp` / `nbf`) | ✅ | ✅ | ✅ | ✅ |
| Auth bypass when `CLIENT_ID` not configured | ✅ | ✅ | ✅ | ✅ |
| Rate-limit failed token validations (5 s) | SHOULD | ❌ | ✅ (sha256-hashed token cache) | ❌ |

> **Note**: .NET uses MSAL's built-in JWT validation which handles many of these features natively. Node.js uses the `jose` library for modern, standards-compliant JWT validation. Python implements validation manually using `PyJWT` and `httpx` for JWKS fetching (in `botas.bot_auth`, not `bot_auth_middleware`). When adding a new language port, ensure all features in this table are covered.

> **No-auth mode**: When `CLIENT_ID` is not configured, the **framework** (e.g., `BotApp.Create`) MUST skip JWT validation entirely — the auth middleware is not registered. However, the validation function itself (`validateBotToken` in Node.js, `validate_bot_token` in Python `botas.bot_auth`, the JWT bearer scheme in .NET `JwtExtensions`) MUST require an `appId`/`CLIENT_ID` and throw/raise an error if it is not provided. This ensures that no-auth mode is an explicit framework-level decision, not a silent validation bypass at the function level.

> **Known gap**: The .NET implementation does not include `https://login.microsoftonline.com/{tenantId}/v2.0` in its `ValidIssuers` list (see line 137 and 265 of `dotnet/src/Botas/JwtExtensions.cs`). MSAL still validates the signature and audience, but tokens whose `iss` ends in `/v2.0` will be rejected at the issuer-comparison step. Node.js and Python accept both `/v2` and `/v2.0`.

> **OpenID config URL variation**: Some implementations may fetch from `https://login.microsoftonline.com/{tid}/v2.0/.well-known/openidconfiguration` (without hyphen) instead of the hyphenated form. Both URLs return equivalent metadata.

---

## References

- [Protocol Spec](./protocol.md) — overall HTTP contract
- [Bot Service Authentication](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-authentication)
- [OpenID Configuration (Bot Service)](https://login.botframework.com/v1/.well-known/openid-configuration)
