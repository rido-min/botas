# Inbound Authentication Spec

**Purpose**: Define how bots validate incoming requests from the Bot Framework Service.
**Status**: Draft

---

## Overview

Every `POST /api/messages` request from the Bot Framework Service carries a JWT bearer token in the `Authorization` header. The bot MUST validate this token **before** processing the activity. An invalid or missing token MUST result in a `401 Unauthorized` response.

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
| Bot Framework global issuer | `https://api.botframework.com` |

The Client ID is read from the `CLIENT_ID` environment variable.

### 2. Issuer (`iss`)

The following issuers MUST be accepted:

| Issuer | When used |
|--------|-----------|
| `https://api.botframework.com` | Tokens from the global Bot Framework channel |
| `https://sts.windows.net/{tenantId}/` | Tokens from Azure AD v1 endpoints |
| `https://login.microsoftonline.com/{tenantId}/v2` | Tokens from Azure AD v2 endpoints |
| `https://login.microsoftonline.com/{tenantId}/v2.0` | Tokens from Azure AD v2 endpoints (alternate format) |

Where `{tenantId}` is the Azure AD tenant ID from the token's `tid` claim.

### 3. Signature (JWKS)

Token signatures MUST be verified against public keys retrieved from the appropriate OpenID configuration endpoint (see below).

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

Implementations SHOULD cache the JWKS keys and OpenID configuration to avoid fetching on every request. A reasonable cache duration is 24 hours, with a fallback re-fetch on key-not-found errors.

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

## References

- [Protocol Spec](./protocol.md) — overall HTTP contract
- [Bot Framework Authentication](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-authentication)
- [OpenID Configuration (Bot Framework)](https://login.botframework.com/v1/.well-known/openid-configuration)
