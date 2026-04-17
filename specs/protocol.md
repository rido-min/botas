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

**Case sensitivity**: Handler lookup by `activity.type` SHOULD use **case-insensitive** comparison. Activity type strings from the Bot Framework (e.g., `"message"`, `"invoke"`) are lowercase by convention, but implementations should tolerate case variations for robustness.

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
3. **Protect against prototype pollution** — JSON parsers MUST strip keys like `__proto__`, `constructor`, and `prototype` from parsed activity payloads. This is critical for JavaScript/Node.js implementations. Languages without prototype chains (Python, .NET, Go) SHOULD still strip these keys for defense-in-depth.

Implementations SHOULD enforce a maximum request body size (recommended: 1 MB) and return `413` on overflow.

### Service URL Validation

The `serviceUrl` from inbound activities MUST be validated against an allowlist before processing. This prevents SSRF attacks where a malicious activity could trick the bot into making requests to arbitrary URLs.

**Allowed hosts:**

| Host pattern | Description |
|--------------|-------------|
| `*.botframework.com` | Global Bot Framework service |
| `*.botframework.us` | US government cloud |
| `*.botframework.cn` | China cloud |
| `*.trafficmanager.net` | Azure Traffic Manager (used by some channels) |
| `localhost` / `127.0.0.1` | Local development only |

**Rules:**

- HTTPS is required for all hosts except `localhost` / `127.0.0.1`.
- The same validation MUST apply to `serviceUrl` used in outbound requests (see [Outbound: Sending Activities](#outbound-sending-activities)).

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

> The legacy `ITurnMiddleware` interface (class with `onTurnAsync`) still exists as a deprecated alias.

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

Returns the middleware instance, so registration calls can be chained on `BotApplication`:

```csharp
bot.Use(new A());
bot.Use(new B());
```

**Node.js:**

```typescript
const bot = new BotApplication()
bot.use(async (context, next) => {
  console.log(`▶ ${context.activity.type}`)
  await next()
}).use(async (context, next) => {
  try { await next() } catch (err) { console.error(err) }
})
```

`use()` returns `this` for chaining.

**Python:**

```python
bot = BotApplication()
bot.use(LoggingMiddleware())
bot.use(ErrorHandlingMiddleware())
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

#### Logging

Log every incoming activity and measure handler latency:

```csharp
// .NET
public class LoggingMiddleware : ITurnMiddleWare
{
    public async Task OnTurnAsync(TurnContext context, NextDelegate next, CancellationToken ct = default)
    {
        Console.WriteLine($"▶ {context.Activity.Type}");
        var sw = Stopwatch.StartNew();
        await next(ct);
        Console.WriteLine($"◀ {context.Activity.Type} ({sw.ElapsedMilliseconds}ms)");
    }
}
```

```typescript
// Node.js
import type { TurnMiddleware } from 'botas'

const loggingMiddleware: TurnMiddleware = async (context, next) => {
  console.log(`▶ ${context.activity.type}`)
  const start = Date.now()
  await next()
  console.log(`◀ ${context.activity.type} (${Date.now() - start}ms)`)
}
```

```python
# Python
import time
from botas import TurnMiddleware

class LoggingMiddleware(TurnMiddleware):
    async def on_turn(self, context, next):
        print(f"▶ {context.activity.type}")
        start = time.monotonic()
        await next()
        elapsed = (time.monotonic() - start) * 1000
        print(f"◀ {context.activity.type} ({elapsed:.0f}ms)")
```

#### Error Handling

Catch handler exceptions and send a fallback reply:

```csharp
// .NET
public class ErrorHandlingMiddleware : ITurnMiddleWare
{
    public async Task OnTurnAsync(TurnContext context, NextDelegate next, CancellationToken ct = default)
    {
        try
        {
            await next(ct);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            await context.SendAsync("Sorry, something went wrong.", ct);
        }
    }
}
```

#### Short-Circuiting (Filter)

Only let `message` activities through:

```typescript
// Node.js
import type { TurnMiddleware } from 'botas'

const messagesOnly: TurnMiddleware = async (context, next) => {
  if (context.activity.type === 'message') {
    await next()
  }
  // other types are silently dropped
}
```

#### Activity Modification

Normalize incoming text:

```python
# Python
from botas import TurnMiddleware

class NormalizeTextMiddleware(TurnMiddleware):
    async def on_turn(self, context, next):
        if context.activity.type == "message" and context.activity.text:
            context.activity.text = context.activity.text.strip().lower()
        await next()
```

#### Remove Bot Mention

Strip the bot's `@mention` from message text in Teams group chats. BotAS ships a built-in `RemoveMentionMiddleware` for this — see the [Middleware Guide](../docs-site/middleware.md#example-remove-bot-mention-middleware) for a full annotated implementation.

```csharp
// .NET
app.Use(new RemoveMentionMiddleware());
```

```typescript
// Node.js — import from botas
import { removeMentionMiddleware } from 'botas'
bot.use(removeMentionMiddleware())
```

```python
# Python — import from botas
from botas import RemoveMentionMiddleware
bot.use(RemoveMentionMiddleware())
```

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

> **Note**: Some channels (e.g., Microsoft Teams agents channel) include semicolons in conversation IDs (e.g., `a]concat-123;messageid=9876`). When constructing the URL, implementations MUST truncate the conversation ID at the first `;` character before URL-encoding it. The full conversation ID is still used in the activity body.

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

### ConversationClient API Surface

Beyond sending activities, the `ConversationClient` wraps the [Bot Framework v3 Conversations REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#conversations-object):

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
