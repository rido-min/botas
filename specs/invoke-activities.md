# Invoke Activities Spec

**Purpose**: Define the invoke activity request/response pattern, handler dispatch, and cross-language API surface.
**Status**: Draft
**Issue**: [#78](https://github.com/rido-min/botas/issues/78)
**Reference**: [microsoft/teams.net — TeamsBotApplication.cs](https://github.com/microsoft/teams.net/blob/next/core/core/src/Microsoft.Teams.Bot.Apps/TeamsBotApplication.cs)

---

## Overview

Invoke activities are a special category of Bot Framework activity where the channel **expects a synchronous response body** from the bot, unlike standard activity types (message, conversationUpdate, etc.) which return an empty `{}`.

Common invoke scenarios include:
- Adaptive Card `Action.Execute` buttons
- Task module fetch/submit dialogs
- Messaging extension queries and actions
- Sign-in token exchanges (SSO)
- File consent responses
- Search-based messaging extensions

The key architectural difference: **invoke handlers return a value** that becomes the HTTP response body, rather than simply processing the activity and returning `{}`.

---

## Protocol: Invoke Request/Response

### Inbound Invoke

Invoke activities arrive at the same `POST /api/messages` endpoint as all other activities. They are distinguished by `activity.type === "invoke"` and carry two additional fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | The invoke action name (e.g., `adaptiveCard/action`, `task/fetch`). Used for sub-type dispatch. |
| `value` | `object` | Action-specific payload (card action data, task module input, query text, etc.). |

### Response Contract

Unlike other activity types where `POST /api/messages` returns `200 {}`, invoke activities **MUST** return a response body:

| Condition | Status | Body |
|-----------|--------|------|
| Handler returns a result | 200 | `{ "status": 200, "body": <handler-result> }` |
| No handler registered for this invoke name | 501 | `{ "status": 501 }` |
| Handler throws an exception | 500 | Implementation-defined |

The response is an **InvokeResponse** envelope:

```json
{
  "status": 200,
  "body": { ... }
}
```

The `status` field is the logical status of the invoke operation. The HTTP response status code for the `POST /api/messages` request itself is always `200` — the invoke status is carried **inside** the body.

> **Important**: This is a fundamental protocol difference from other activity types. The processing pipeline MUST detect invoke activities and write the handler's return value to the HTTP response body instead of `{}`.

---

## InvokeResponse Type

All languages MUST define an `InvokeResponse` type:

```
InvokeResponse {
    status: int        // HTTP-style status code (200, 400, 404, 501, etc.)
    body:   object?    // Optional response payload
}
```

### Cross-Language Definitions

**.NET:**
```csharp
public class InvokeResponse
{
    public int Status { get; set; }
    public object? Body { get; set; }

    public InvokeResponse(int status, object? body = null)
    {
        Status = status;
        Body = body;
    }
}
```

**Node.js:**
```typescript
interface InvokeResponse {
    status: number
    body?: unknown
}
```

**Python:**
```python
@dataclass
class InvokeResponse:
    status: int
    body: Any = None
```

---

## Handler Dispatch

### Two-Level Dispatch

Invoke activities use a two-level dispatch model:

1. **By type**: `activity.type === "invoke"` — selects the invoke processing path
2. **By name**: `activity.name` — selects the specific invoke handler

This means the `on("invoke", handler)` pattern from standard activity dispatch is **not sufficient** for production use. Implementations MUST support dispatch by invoke name.

### Registration API

#### Specific Invoke Handlers (Recommended)

Register handlers for specific invoke names using a compound key `"invoke/{name}"`:

**.NET:**
```csharp
app.OnInvoke("adaptiveCard/action", async (ctx, ct) =>
{
    var data = ctx.Activity.Value;
    return new InvokeResponse(200, new { statusCode = 200, type = "application/vnd.microsoft.card.adaptive", value = cardJson });
});
```

**Node.js:**
```typescript
app.onInvoke('adaptiveCard/action', async (ctx) => {
    const data = ctx.activity.value
    return { status: 200, body: { statusCode: 200, type: 'application/vnd.microsoft.card.adaptive', value: cardJson } }
})
```

**Python:**
```python
@app.on_invoke("adaptiveCard/action")
async def handle_card_action(ctx):
    data = ctx.activity.value
    return InvokeResponse(200, {"statusCode": 200, "type": "application/vnd.microsoft.card.adaptive", "value": card_json})
```

#### CatchAll Invoke Handler

A catch-all invoke handler receives ALL invoke activities regardless of name. It is **mutually exclusive** with specific invoke handlers — registering both MUST raise an error at registration time.

**.NET:**
```csharp
app.OnInvoke(async (ctx, ct) =>
{
    // ctx.Activity.Name contains the invoke name
    return new InvokeResponse(200, result);
});
```

**Node.js:**
```typescript
app.onInvoke(async (ctx) => {
    return { status: 200, body: result }
})
```

**Python:**
```python
@app.on_invoke()
async def handle_all_invokes(ctx):
    return InvokeResponse(200, result)
```

### Mutual Exclusion Rule

Following the [Teams.net reference](https://github.com/microsoft/teams.net/blob/next/core/core/src/Microsoft.Teams.Bot.Apps/Routing/Router.cs):

- Registering a catch-all invoke handler when specific invoke handlers exist → **error**
- Registering a specific invoke handler when a catch-all invoke handler exists → **error**
- Registering multiple specific invoke handlers for different names → **allowed**
- Registering two handlers for the same invoke name → **error** (replaces or rejects, per language idiom)

---

## Processing Pipeline Changes

The existing processing pipeline (from [protocol.md](./protocol.md)) requires modification for invoke activities:

```
HTTP POST /api/messages
  └─ JWT validation (reject with 401 if invalid)
       └─ Middleware chain (registration order)
            └─ Handler dispatch
                 ├─ activity.type !== "invoke" → per-type dispatch → return {}
                 └─ activity.type === "invoke" → invoke dispatch → return InvokeResponse as body
```

### Pipeline Behavior

1. **Middleware**: Executes identically for invoke and non-invoke activities. Middleware receives the full `TurnContext` and can inspect/modify the activity.

2. **Invoke Detection**: After middleware, the pipeline checks `activity.type`. If it equals `"invoke"`, the invoke dispatch path is taken.

3. **Invoke Dispatch**:
   - Look up handler by `"invoke/{activity.name}"` (specific) or `"invoke"` (catch-all)
   - If found: call handler, capture `InvokeResponse` return value
   - If not found: return `InvokeResponse(501)` (Not Implemented)

4. **Response Writing**: The framework writes the `InvokeResponse` as the HTTP response body instead of `{}`.

### TurnContext Extension

For invoke handlers, `TurnContext` is extended with the ability to return a value. The handler's return value is captured by the pipeline.

---

## Common Invoke Names

The `activity.name` field determines the invoke sub-type. These are the most common invoke names sent by Microsoft Teams:

### Adaptive Cards

| Name | Trigger | Expected Response |
|------|---------|-------------------|
| `adaptiveCard/action` | User clicks `Action.Execute` button | Adaptive Card (to update the card) or message |

### Task Modules (Dialogs)

| Name | Trigger | Expected Response |
|------|---------|-------------------|
| `task/fetch` | Task module is opened (e.g., from a button or command) | `TaskModuleResponse` with card content or URL |
| `task/submit` | User submits data from a task module | `TaskModuleResponse` (next dialog) or empty (close) |

### Messaging Extensions

| Name | Trigger | Expected Response |
|------|---------|-------------------|
| `composeExtension/query` | User types in a search-based messaging extension | `MessagingExtensionResponse` with results |
| `composeExtension/selectItem` | User selects an item from search results | `MessagingExtensionResponse` with detail card |
| `composeExtension/submitAction` | User submits an action-based messaging extension | `MessagingExtensionResponse` or card |
| `composeExtension/fetchTask` | Action ME opens (fetch the task module) | `MessagingExtensionResponse` with task info |
| `composeExtension/queryLink` | Link unfurling | `MessagingExtensionResponse` with card |
| `composeExtension/setting` | ME settings page requested | `MessagingExtensionResponse` |
| `composeExtension/onCardButtonClicked` | Card button in ME result clicked | Empty (acknowledgment) |

### Sign-In / SSO

| Name | Trigger | Expected Response |
|------|---------|-------------------|
| `signin/tokenExchange` | SSO token exchange request | `InvokeResponse(200)` on success, `InvokeResponse(412)` with failure detail on error |
| `signin/verifyState` | OAuth magic code verification | `InvokeResponse(200)` or error |

### File Consent

| Name | Trigger | Expected Response |
|------|---------|-------------------|
| `fileConsent/invoke` | User accepts/declines file upload consent | Acknowledgment |

### Config

| Name | Trigger | Expected Response |
|------|---------|-------------------|
| `config/fetch` | Bot configuration page requested | Configuration page response |
| `config/submit` | Bot configuration submitted | Acknowledgment |

> The invoke name is an open-ended string. Implementations MUST support registering handlers for arbitrary invoke names, not just the ones listed above.

---

## Invoke Activity Payload Examples

### adaptiveCard/action

```json
{
  "type": "invoke",
  "name": "adaptiveCard/action",
  "value": {
    "action": {
      "type": "Action.Execute",
      "verb": "doSomething",
      "data": { "choice": "option-a" }
    }
  }
}
```

**Response:**
```json
{
  "status": 200,
  "body": {
    "statusCode": 200,
    "type": "application/vnd.microsoft.card.adaptive",
    "value": { "type": "AdaptiveCard", "body": [...], "$schema": "..." }
  }
}
```

### task/fetch

```json
{
  "type": "invoke",
  "name": "task/fetch",
  "value": {
    "data": { "source": "mainMenu" }
  }
}
```

**Response:**
```json
{
  "status": 200,
  "body": {
    "task": {
      "type": "continue",
      "value": {
        "title": "Task Module Title",
        "width": "medium",
        "height": "medium",
        "card": { "contentType": "application/vnd.microsoft.card.adaptive", "content": { ... } }
      }
    }
  }
}
```

### task/submit

```json
{
  "type": "invoke",
  "name": "task/submit",
  "value": {
    "data": { "email": "user@example.com", "name": "Alice" }
  }
}
```

**Response (close dialog):**
```json
{
  "status": 200,
  "body": null
}
```

**Response (chain to next dialog):**
```json
{
  "status": 200,
  "body": {
    "task": {
      "type": "continue",
      "value": { "title": "Confirmation", "card": { ... } }
    }
  }
}
```

---

## Cross-Language API Surface

### Handler Registration

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Specific invoke | `app.OnInvoke("name", handler)` | `app.onInvoke("name", handler)` | `@app.on_invoke("name")` or `app.on_invoke("name", handler)` |
| CatchAll invoke | `app.OnInvoke(handler)` | `app.onInvoke(handler)` | `@app.on_invoke()` or `app.on_invoke(handler)` |
| Handler return type | `Task<InvokeResponse>` | `Promise<InvokeResponse>` | `Awaitable[InvokeResponse]` |

### Handler Signatures

**.NET:**
```csharp
// Specific
app.OnInvoke("adaptiveCard/action",
    async (TurnContext ctx, CancellationToken ct) => new InvokeResponse(200, body));

// CatchAll
app.OnInvoke(
    async (TurnContext ctx, CancellationToken ct) => new InvokeResponse(200, body));
```

**Node.js:**
```typescript
// Specific
app.onInvoke('adaptiveCard/action',
    async (ctx: TurnContext): Promise<InvokeResponse> => ({ status: 200, body }))

// CatchAll
app.onInvoke(
    async (ctx: TurnContext): Promise<InvokeResponse> => ({ status: 200, body }))
```

**Python:**
```python
# Specific (decorator)
@app.on_invoke("adaptiveCard/action")
async def handle(ctx: TurnContext) -> InvokeResponse:
    return InvokeResponse(200, body)

# Specific (method)
app.on_invoke("adaptiveCard/action", handle)

# CatchAll (decorator)
@app.on_invoke()
async def handle_all(ctx: TurnContext) -> InvokeResponse:
    return InvokeResponse(200, body)
```

### InvokeResponse Type

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Type name | `InvokeResponse` | `InvokeResponse` (interface) | `InvokeResponse` (dataclass) |
| Status field | `Status` (int) | `status` (number) | `status` (int) |
| Body field | `Body` (object?) | `body` (unknown?) | `body` (Any) |
| Constructor | `new InvokeResponse(status, body?)` | `{ status, body? }` (object literal) | `InvokeResponse(status, body=None)` |

---

## Error Handling

### Handler Exceptions

Exceptions thrown inside invoke handlers MUST be wrapped in `BotHandlerException` (consistent with [protocol.md — Error Wrapping](./protocol.md#error-wrapping)). The pipeline then returns:
- HTTP 500 to the caller
- The `BotHandlerException` is available for logging/middleware error handling

### No Handler Registered

When an invoke activity arrives with a `name` that has no registered handler (and no catch-all invoke handler is set):
- Return `InvokeResponse(501)` — "Not Implemented"
- Do NOT throw an exception
- Do NOT silently ignore (unlike non-invoke unregistered types)

This differs from the standard "silently ignore unregistered types" behavior because invoke activities **require** a response. A missing response would cause the channel to time out.

### Handler Returns null/None

If a handler returns `null` (or `None` in Python) instead of an `InvokeResponse`:
- Treat as `InvokeResponse(200)` with no body
- This is a convenience for handlers that just need to acknowledge

---

## Outbound Filtering

As documented in [protocol.md](./protocol.md#outbound-activity-filtering), `invoke` activities MUST be silently skipped by the conversation client when sending outbound. Invoke activities are inbound-only (channel → bot). The bot responds via the HTTP response body, not by sending a separate activity.

---

## Implementation Notes

### Separation of Concerns

The invoke dispatch mechanism extends the existing handler dispatch, not replaces it. The pipeline flow is:

1. Existing `on("invoke", ...)` handler (if any) is a **generic invoke handler** — it receives all invokes. This is the current behavior and remains backward-compatible.
2. The new `onInvoke("name", ...)` API adds **name-based dispatch** as a layer on top.
3. If both `on("invoke", ...)` and `onInvoke(...)` are registered, `onInvoke` takes precedence for matching invoke names; `on("invoke", ...)` acts as a fallback.

### Backward Compatibility

Existing bots that use `on("invoke", handler)` (where the handler ignores the return value and the framework returns `{}`) will continue to work. However, these bots should migrate to `onInvoke()` to properly return `InvokeResponse` values.

### HTTP Response Integration

The framework-specific HTTP layer must be aware of invoke responses:

- **.NET** (`ProcessAsync`): When the activity is an invoke, write `InvokeResponse` JSON to `HttpContext.Response` instead of `{}`.
- **Node.js** (`processAsync`): When the activity is an invoke, write `InvokeResponse` JSON to the `ServerResponse` instead of `{}`.
- **Python** (`process_body`): Return the `InvokeResponse` so the web framework layer (FastAPI/aiohttp) can serialize it as the response body.

This mirrors the Teams.net reference where `TeamsBotApplication` uses `IHttpContextAccessor` to write the invoke response:
```csharp
httpContext.Response.StatusCode = invokeResponse.Status;
await httpContext.Response.WriteAsJsonAsync(invokeResponse.Body, cancellationToken);
```

---

## Parity Considerations

| Concern | Notes |
|---------|-------|
| Return value from handlers | .NET returns `Task<InvokeResponse>`, Node.js `Promise<InvokeResponse>`, Python `InvokeResponse`. All must surface the return value in the HTTP response. |
| Mutual exclusion enforcement | All languages MUST reject mixing catch-all and specific invoke handlers at registration time. |
| Default 501 for unhandled invokes | All languages MUST return 501 (not silent ignore) when no invoke handler matches. |
| Outbound filtering | All languages already skip `invoke` outbound (verify parity). |
| Error wrapping | Same `BotHandlerException` pattern as other handlers. |
| Middleware compatibility | Middleware runs before invoke dispatch — no changes to middleware contract. |

---

## Implementation Phases

### Phase 1: Core Invoke Support
- `InvokeResponse` type in all three languages
- `onInvoke("name", handler)` registration API
- Catch-all `onInvoke(handler)` registration
- Mutual exclusion enforcement
- Pipeline modification to return `InvokeResponse` body
- 501 default for unhandled invoke names
- Tests: handler dispatch, return value propagation, 501 default, mutual exclusion

### Phase 2: Typed Invoke Handlers (Future)
- Typed activity subtypes for common invokes (e.g., `AdaptiveCardInvokeActivity`, `TaskFetchActivity`)
- Typed response helpers (e.g., `TaskModuleResponse.continue(card)`)
- Sign-in/SSO invoke handlers with built-in token exchange logic

---

## References

- [Protocol](./protocol.md) — HTTP contract, middleware pipeline, handler dispatch
- [Activity Payloads — Invoke](./ActivityPayloads.md#invoke) — JSON payload examples
- [Activity Schema](./activity-schema.md) — `name` and `value` field definitions
- [Teams.net Reference — TeamsBotApplication.cs](https://github.com/microsoft/teams.net/blob/next/core/core/src/Microsoft.Teams.Bot.Apps/TeamsBotApplication.cs)
- [Teams.net Reference — Router.cs](https://github.com/microsoft/teams.net/blob/next/core/core/src/Microsoft.Teams.Bot.Apps/Routing/Router.cs)
- [Teams.net Reference — InvokeActivity.cs](https://github.com/microsoft/teams.net/blob/e10c5ee562a44ed6ed7f16e7ec546d0c0582b17c/Libraries/Microsoft.Teams.Apps/Activities/Invokes/InvokeActivity.cs)
- [Bot Framework REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference)
