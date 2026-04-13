# Protocol Spec

**Purpose**: Define the HTTP protocol contract for bots built with `botas`.
**Status**: Draft

---

## Overview

A `botas` bot communicates with the Microsoft Bot Framework Service over two HTTP channels:

| Direction | Endpoint | Who calls whom |
|-----------|----------|----------------|
| **Inbound** | `POST /api/messages` | Bot Framework → Bot |
| **Outbound** | `POST {serviceUrl}v3/conversations/{conversationId}/activities` | Bot → Bot Framework |

Both channels carry JSON [Activity](./activity-schema.md) payloads authenticated with bearer tokens (see [Inbound Auth](./inbound-auth.md) and [Outbound Auth](./outbound-auth.md)).

---

## Inbound: Receiving Activities

### Endpoint

```
POST /api/messages
```

The path `/api/messages` is the conventional default. Implementations MAY allow it to be configured.

### Request

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {jwt-token}` |

The body is a single [Activity](./activity-schema.md) JSON object.

### Authentication

Every inbound request MUST be authenticated by validating the JWT bearer token **before** any activity processing. See [Inbound Auth](./inbound-auth.md) for full details.

### Processing Pipeline

Once authenticated, the activity flows through the turn pipeline:

```
HTTP POST /api/messages
  └─ JWT validation (reject with 401 if invalid)
       └─ Middleware chain (registration order)
            └─ Handler dispatch (by activity type)
```

#### Middleware

Implementations MUST support a middleware pipeline with these properties:

1. Middleware executes **in registration order**.
2. Each middleware receives the bot application context, the activity, and a `next` delegate.
3. Middleware MAY inspect or modify the activity.
4. Middleware MAY short-circuit by **not** calling `next()`.
5. Middleware MAY perform work after calling `next()` (post-processing).

#### Handler Dispatch

After middleware, the activity is dispatched to a registered handler based on `activity.type`:

- If a handler IS registered for the type → invoke it.
- If NO handler is registered for the type → **silently ignore** the activity (no error).

##### CatchAll Handler

A CatchAll handler is an optional, application-level callback that, when set, **replaces per-type handler dispatch entirely**:

- When a CatchAll handler IS set, all incoming activities bypass per-type dispatch and are delivered directly to the CatchAll handler.
- When a CatchAll handler IS NOT set, the per-type dispatch behavior (above) applies unchanged.
- Per-type handlers registered via `On()` / `on()` / `on_activity()` are **NOT invoked** if a CatchAll handler is set.
- Unregistered activity types with no CatchAll handler are still silently ignored.
- Exceptions thrown inside a CatchAll handler MUST be wrapped in `BotHandlerException` (same as per-type handlers; see [Error Wrapping](#error-wrapping)).

#### Error Wrapping

Any exception thrown inside a handler MUST be wrapped in a language-specific `BotHandlerException` equivalent. The wrapper MUST carry:

- The original exception/error as the inner cause.
- A reference to the activity that triggered the error.

### Response

| Condition | Status | Body |
|-----------|--------|------|
| Success | 200 | `{}` |
| Auth failure | 401 | Implementation-defined |
| Handler error | 500 | Implementation-defined |

On success the response body MUST be `{}` (empty JSON object).

---

## Outbound: Sending Activities

### Endpoint

```
POST {serviceUrl}v3/conversations/{conversationId}/activities
```

- `{serviceUrl}` — the `serviceUrl` from the original inbound activity (unique per conversation).
- `{conversationId}` — `activity.conversation.id`.

### Request

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {oauth-token}` |

The body is a single [Activity](./activity-schema.md) JSON object.

The bearer token MUST be obtained via the OAuth 2.0 client credentials flow. See [Outbound Auth](./outbound-auth.md).

### Response

On success the Bot Framework returns:

```json
{ "id": "new-activity-id" }
```

### Outbound Activity Filtering

Before sending, the conversation client MUST silently skip the following activity types without raising an error:

| Skipped type | Reason |
|--------------|--------|
| `trace` | Diagnostic-only; not intended for the channel. |

Skipped activities return an empty/default result immediately.

---

## Activity Types

| Type | Description |
|------|-------------|
| `message` | Text message from user or bot |

The type string is open-ended — implementations MUST support registering handlers for arbitrary type values.

---

## Configuration

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (or `"common"`) |
| `PORT` | HTTP listen port (default: `3978`) |

---

## References

- [Activity Schema](./activity-schema.md)
- [Inbound Auth](./inbound-auth.md)
- [Outbound Auth](./outbound-auth.md)
- [Bot Framework REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference)
