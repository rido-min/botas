# Protocol Spec

**Purpose**: Define the HTTP protocol contract for bots built with `botas`.
**Status**: Draft

---

## Overview

A `botas` bot communicates with the Microsoft Bot Service Service over two HTTP channels:

| Direction | Endpoint | Who calls whom |
|-----------|----------|----------------|
| **Inbound** | `POST /api/messages` | Bot Service → Bot |
| **Outbound** | `POST {serviceUrl}v3/conversations/{conversationId}/activities` | Bot → Bot Service |

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

> **Auth architecture**: JWT validation is performed at the **adapter/framework layer** (e.g., Express middleware in Node.js, FastAPI dependency in Python, ASP.NET authentication middleware in .NET) — NOT inside `BotApplication` itself. `BotApplication` is web-framework-agnostic and assumes the request has already been authenticated by the time `processBody()` / `ProcessAsync()` is called. The `processAsync(req, res)` method in adapter packages (e.g., `botas-express`) composes auth + body processing. Direct callers of `processBody()` are responsible for performing auth validation separately.

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

**Case sensitivity**: Handler lookup by `activity.type` SHOULD use **case-insensitive** comparison. Activity type strings from the Bot Service (e.g., `"message"`, `"invoke"`) are lowercase by convention, but implementations should tolerate case variations for robustness.

##### CatchAll Handler

A CatchAll handler is an optional, application-level callback that, when set, **replaces per-type handler dispatch for all non-invoke activities**:

- When a CatchAll handler IS set, all incoming **non-invoke** activities bypass per-type dispatch and are delivered directly to the CatchAll handler.
- **Invoke activities ALWAYS bypass the CatchAll handler** and go to invoke-specific dispatch (see [Invoke Activities spec](./invoke-activities.md)).
- When a CatchAll handler IS NOT set, the per-type dispatch behavior (above) applies unchanged.
- Per-type handlers registered via `On()` / `on()` / `on_activity()` are **NOT invoked** if a CatchAll handler is set (except for invoke activities).
- Unregistered activity types with no CatchAll handler are still silently ignored.
- Exceptions thrown inside a CatchAll handler MUST be wrapped in `BotHandlerException` (same as per-type handlers; see [Error Wrapping](#error-wrapping)).

#### Error Wrapping

Any exception thrown inside a handler MUST be wrapped in a language-specific `BotHandlerException` equivalent. The wrapper MUST carry:

- The original exception/error as the inner cause.
- A reference to the activity that triggered the error.

**Constructor signature** (conceptual): `BotHandlerException(message: string, cause: Exception, activity: CoreActivity)`. The `message` is a human-readable description, `cause` is the original exception, and `activity` is the activity being processed when the error occurred.

**Cancellation exceptions**: `OperationCanceledException` (.NET), `AbortError` (Node.js), and `asyncio.CancelledError` (Python) SHOULD be re-thrown without wrapping. These indicate a cancelled request, not a handler error.

### Response

| Condition | Status | Body |
|-----------|--------|------|
| Success | 200 | `{}` |
| Auth failure | 401 | Implementation-defined |
| Handler error | 500 | Implementation-defined |

On success the response body MUST be `{}` (empty JSON object).

### Input Validation

Before processing the activity, implementations MUST:

1. **Validate required fields** — `type` (non-empty string), `serviceUrl` (non-empty string), and `conversation.id` (non-empty string) MUST be present. Return `400` if missing.
2. **Validate service URL** — see [Service URL Validation](#service-url-validation) below.
3. **Protect against prototype pollution** — In languages with prototype chains (JavaScript/Node.js), JSON parsers MUST strip keys like `__proto__`, `constructor`, and `prototype` from parsed activity payloads. Strongly-typed languages (.NET, Go, Java) naturally reject unknown properties during deserialization and do not need explicit stripping. Dynamic languages without prototype chains (Python, Ruby) SHOULD strip these keys for defense-in-depth, though the risk is lower.

Implementations MUST enforce a maximum request body size of **1 MB** and return `413` on overflow.

Implementations SHOULD also enforce field-level limits on parsed activities to prevent abuse:

| Field | Limit | Description |
|-------|-------|-------------|
| `text` | 50,000 characters | Maximum message text length |
| `entities` | 100 items | Maximum entity count |
| `attachments` | 50 items | Maximum attachment count |

Activities exceeding these limits SHOULD be rejected with `400 Bad Request`.

### Service URL Validation

The `serviceUrl` from inbound activities MUST be validated against an allowlist before the bot makes **outbound** HTTP requests to that URL. This prevents SSRF attacks where a malicious activity could trick the bot into making requests to arbitrary URLs.

> **Validation timing**: Service URL validation MUST occur in `ConversationClient` before any outbound HTTP request — NOT during inbound activity processing. Inbound activities are already authenticated via JWT validation, and rejecting them based on `serviceUrl` would prevent the bot from processing legitimate activities from new or unfamiliar service endpoints. The validation protects against outbound SSRF, not inbound trust.

**Allowed hosts:**

| Host pattern | Description |
|--------------|-------------|
| `*.botframework.com` | Global Bot Service service |
| `*.botframework.us` | US government cloud |
| `*.botframework.cn` | China cloud |
| `smba.trafficmanager.net` | Azure Traffic Manager (Teams) — exact match only |
| `localhost` / `127.0.0.1` | Local development only |

> **Security note**: Previous versions allowed `*.trafficmanager.net` wildcards. This was removed because an attacker could create a malicious `trafficmanager.net` subdomain. Only the exact host `smba.trafficmanager.net` is now permitted.

**Additional allowed URLs (`ALLOWED_SERVICE_URLS`):**

Implementations MUST support an `ALLOWED_SERVICE_URLS` environment variable containing a comma-separated list of additional allowed URL prefixes. Each entry is compared as a case-insensitive prefix match against the full service URL. Example:

```
ALLOWED_SERVICE_URLS=https://custom.example.com,https://internal.corp.net
```

**Rules:**

- HTTPS is required for all hosts except `localhost` / `127.0.0.1`.
- See [Validation Timing](#service-url-validation) above — validation is enforced in `ConversationClient` before outbound HTTP calls.

---

## Middleware

Middleware intercepts every incoming activity before it reaches the handler. Common uses include logging, error handling, activity filtering, and input normalization.

### Middleware Pipeline

```
HTTP POST /api/messages
  └─ JWT validation (401 on failure)
       └─ Middleware[0](context, next)
            └─ Middleware[1](context, next)
                 └─ ...
                      └─ Middleware[N](context, next)
                           └─ Handler dispatch (by activity.type)
```

### Rules

These rules are behavioral invariants that all implementations MUST follow:

1. **Registration order** — Middleware executes in the order it is registered via `Use()` / `use()`.
2. **Pre- and post-processing** — Code before `next()` runs on the way in; code after `next()` runs on the way out.
3. **Short-circuiting** — If a middleware does **not** call `next()`, all subsequent middleware and the handler are skipped.
4. **Activity modification** — Middleware MAY inspect or modify `context.activity`. Changes persist through the pipeline and reach the handler.
5. **Send from middleware** — Middleware MAY call `context.send()` before or after `next()`.
6. **Shared context** — The same `TurnContext` instance is passed to all middleware and the handler within a single turn.
7. **Exception propagation** — If a handler throws, the exception propagates back through the middleware chain (each middleware's `next()` call throws). Middleware MAY catch and handle exceptions.
8. **Detached next() suppression** — If a middleware calls `next()` and then throws (or rejects), the framework SHOULD suppress the detached `next()` promise/task rejection to avoid unhandled rejection warnings. This is an edge case but matters for production robustness in async runtimes.

### Interface

**.NET:**

```csharp
public delegate Task NextDelegate(CancellationToken cancellationToken);

public interface ITurnMiddleWare
{
    Task OnTurnAsync(
        TurnContext context,
        NextDelegate next,
        CancellationToken cancellationToken = default);
}
```

> Note: The interface is named `ITurnMiddleWare` (capital W) — this is intentional and preserved for compatibility.

**Node.js:**

```typescript
type NextTurn = () => Promise<void>

type TurnMiddleware = (context: TurnContext, next: NextTurn) => Promise<void>
```

> The legacy `ITurnMiddleware` interface (class with `onTurnAsync`) has been removed from public exports. Use `TurnMiddleware` instead.

**Python:**

```python
NextTurn = Callable[[], Awaitable[None]]

class TurnMiddleware(Protocol):
    async def on_turn(
        self,
        context: TurnContext,
        next: NextTurn,
    ) -> None: ...
```

> The legacy `ITurnMiddleware` name is kept as an alias: `ITurnMiddleware = TurnMiddleware`.

### Registration

**.NET:**

```csharp
var app = BotApp.Create(args);
app.Use(new LoggingMiddleware());
app.Use(new ErrorHandlingMiddleware());
```

**Node.js** (`use()` returns `this` for chaining):

```typescript
const bot = new BotApplication()
bot.use(async (context, next) => {
  console.log(`▶ ${context.activity.type}`)
  await next()
})
```

**Python:**

```python
bot = BotApplication()
bot.use(LoggingMiddleware())
```

### Execution Order Example

Given three middleware registered in order A → B → C:

```
→ A.pre
  → B.pre
    → C.pre
      → Handler
    ← C.post
  ← B.post
← A.post
```

If B does not call `next()`:

```
→ A.pre
  → B (no next call)
← A.post
```

C and the handler are never reached.

### Patterns

For middleware implementation patterns (logging, error handling, short-circuiting, activity modification, remove-mention), see the [Middleware Guide](../docs-site/middleware.md) and [language-specific reference docs](./reference/).

### RemoveMentionMiddleware

All implementations MUST include a `RemoveMentionMiddleware` that strips the bot's @mention from `activity.text`:

**Bot ID resolution**: The middleware MUST use `app.appId` (the bot's `CLIENT_ID` from the token manager) as the primary bot identifier, falling back to `activity.recipient.id` if `appId` is not available (e.g., in no-auth mode).

**Matching rules**:
- Bot ID comparison MUST be **case-insensitive** (`casefold()` in Python, `toLowerCase()` in Node, `OrdinalIgnoreCase` in .NET).
- Mention text removal from `activity.text` MUST be **case-insensitive** (e.g., `re.sub` with `IGNORECASE` flag, not plain `str.replace`).
- After removing the mention text, the resulting text SHOULD be trimmed of leading/trailing whitespace.

### Interaction with CatchAll Handler

When a CatchAll handler (`OnActivity` / `onActivity` / `on_activity`) is set, middleware still executes normally. The CatchAll replaces per-type dispatch at the end of the pipeline — it does not bypass middleware.

```
Middleware[0] → Middleware[1] → ... → CatchAll handler
```

See [CatchAll Handler](#catchall-handler) for details.

---

## Outbound: Sending Activities

### Endpoint

```
POST {serviceUrl}/v3/conversations/{conversationId}/activities
```

- `{serviceUrl}` — the `serviceUrl` from the original inbound activity (unique per conversation). Implementations MUST normalize trailing slashes — the URL should have exactly one `/` between `{serviceUrl}` and `v3` regardless of whether `serviceUrl` ends with `/`.
- `{conversationId}` — `activity.conversation.id`.

> **Note**: Some channels (e.g., Microsoft Teams agents channel) include semicolons in conversation IDs (e.g., `a]concat-123;messageid=9876`). When constructing the URL, implementations MUST URL-encode the full conversation ID to ensure special characters are safely included in the path. Do NOT truncate at `;` or any other character.

### Request

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {oauth-token}` |

The body is a single [Activity](./activity-schema.md) JSON object.

The bearer token MUST be obtained via the OAuth 2.0 client credentials flow. See [Outbound Auth](./outbound-auth.md).

### Response

On success the Bot Service returns:

```json
{ "id": "new-activity-id" }
```

### ConversationClient API Surface

Beyond sending activities, the `ConversationClient` wraps the [Bot Service v3 Conversations REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#conversations-object):

| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| Send activity | `POST` | `v3/conversations/{id}/activities` | Send an activity to a conversation |
| Update activity | `PUT` | `v3/conversations/{id}/activities/{activityId}` | Update an existing activity |
| Delete activity | `DELETE` | `v3/conversations/{id}/activities/{activityId}` | Delete an activity |
| Create conversation | `POST` | `v3/conversations` | Create a new 1:1 or group conversation |
| Get members | `GET` | `v3/conversations/{id}/members` | List all conversation members |
| Get member | `GET` | `v3/conversations/{id}/members/{memberId}` | Get a single member by ID |
| Get paged members | `GET` | `v3/conversations/{id}/pagedmembers` | List members with pagination |
| Delete member | `DELETE` | `v3/conversations/{id}/members/{memberId}` | Remove a member from a conversation |
| Get conversations | `GET` | `v3/conversations` | List conversations the bot is in |
| Send history | `POST` | `v3/conversations/{id}/activities/history` | Upload a conversation transcript |

All methods require outbound authentication (see [Outbound Auth](./outbound-auth.md)) and service URL validation.

---

## Activity Types

| Type | Description |
|------|-------------|
| `message` | Text message from user or bot |

The type string is open-ended — implementations MUST support registering handlers for arbitrary type values.

---

## Resource Cleanup

`BotApplication` and `ConversationClient` hold HTTP clients and other resources that should be cleaned up when the application shuts down.

| Language | Cleanup mechanism | Details |
|----------|-------------------|---------|
| .NET | `IAsyncDisposable` / DI container | ASP.NET Core's DI container manages `HttpClient` lifetime via `IHttpClientFactory`. No explicit cleanup needed when using `BotApp.Create()`. |
| Node.js | `process.on('SIGTERM', ...)` | The built-in `fetch` API manages connections automatically. No explicit cleanup required. |
| Python | `async with` context manager or `aclose()` | `BotApplication` implements `__aenter__`/`__aexit__` for use with `async with`. Call `aclose()` explicitly if not using the context manager. This ensures the underlying `httpx.AsyncClient` is properly closed. |

Implementations SHOULD ensure HTTP connections are closed on shutdown. The exact mechanism is language-specific and does not need to be identical across ports.

---

## Configuration

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (or `"common"`) |
| `PORT` | HTTP listen port (default: `3978`) |
| `ALLOWED_SERVICE_URLS` | Comma-separated list of additional allowed service URL prefixes |

---

## Operational Endpoints

Implementations SHOULD provide the following endpoints for operational monitoring:

| Endpoint | Method | Response | Description |
|----------|--------|----------|-------------|
| `/health` | `GET` | `{ "status": "ok" }` | Health check for load balancers and orchestrators |
| `/` | `GET` | `"Bot {AppId} Running"` | Human-readable status page |

These are recommended for production readiness but are not required by the Bot Service protocol.

---

## Logging

Implementations SHOULD use structured logging throughout the library. Key events to log:

| Event | Level | Description |
|-------|-------|-------------|
| Activity received | Debug | Activity type, conversation ID |
| Auth validation failure | Warning | Reason (without leaking token details) |
| Handler dispatch | Debug | Activity type, handler found/not found |
| Outbound HTTP request | Debug | Method, URL (without auth header) |
| Outbound HTTP error | Error | Status code, response body summary |
| Service URL validation failure | Warning | URL that failed validation |

Use language-idiomatic logging frameworks: `ILogger<T>` (.NET), `console` or configurable logger (Node.js), `logging` module (Python).

---

## References

- [Activity Schema](./activity-schema.md)
- [Inbound Auth](./inbound-auth.md)
- [Outbound Auth](./outbound-auth.md)
- [Bot Service REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference)
