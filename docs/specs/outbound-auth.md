# Outbound Authentication Spec

**Purpose**: Define how bots authenticate outbound requests to the Bot Framework Service.
**Status**: Draft

---

## Overview

When a bot sends an activity to the Bot Framework (e.g., replying to a user), the HTTP request MUST include a bearer token obtained via the OAuth 2.0 client credentials flow. This token proves the bot's identity to the Bot Framework Service.

---

## Token Acquisition

### Grant Type

OAuth 2.0 **client credentials** grant (`grant_type=client_credentials`).

### Token Endpoint

```
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
```

Where `{tenantId}` is the bot's Azure AD tenant ID, read from the `TENANT_ID` environment variable.

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

Every outbound HTTP request to the Bot Framework MUST include the token:

```
Authorization: Bearer {access_token}
```

This applies to all outbound calls, including:

- Sending activities (`POST {serviceUrl}v3/conversations/{conversationId}/activities`)
- Any future Bot Framework REST API calls

---

## Token Caching

Implementations MUST cache the access token and reuse it until it expires. Best practices:

1. Cache the token along with its `expires_in` value.
2. Refresh the token **before** it expires (e.g., with a small buffer of 60–300 seconds).
3. Handle token refresh failures gracefully — retry or propagate the error.

Implementations SHOULD NOT request a new token for every outbound call.

---

## Configuration

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID |

All three are required for outbound authentication.

---

## References

- [Protocol Spec](./protocol.md) — overall HTTP contract
- [Microsoft Identity Platform Client Credentials Flow](https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow)
- [Bot Framework Authentication](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-authentication)
