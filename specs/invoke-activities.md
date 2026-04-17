# Invoke Activities Spec

**Purpose**: Define how `botas` handles invoke activities and dispatches by `activity.name`.  
**Status**: Implemented (PR #79)

---

## Overview

Invoke activities are request-response style messages used in Microsoft Teams for:
- Adaptive Card action submissions (`adaptiveCard/action`)
- Message extension queries and actions (`composeExtension/*`, `messaging/*`)
- Task module operations (`task/fetch`, `task/submit`)
- Sign-in verification (`signin/verifyState`)
- File consent interactions (`fileConsent/*`)

Unlike regular activity types (message, conversationUpdate) which are fire-and-forget, **invoke activities require a synchronous HTTP response** with a status code and optional JSON body.

---

## Hierarchical Dispatch

`botas` provides **hierarchical dispatch** for invoke activities:
- Register handlers by **full invoke name** (e.g., `adaptiveCard/action`)
- Dispatch by `activity.name` when `activity.type === "invoke"`
- Support a catch-all invoke handler for unregistered names
- Return an `InvokeResponse` object with status code and optional body

### Key Principles

1. **Hierarchical naming**: Use `/` separator for invoke names (e.g., `adaptiveCard/action`, `task/fetch`).
2. **Parity with Teams.NET**: Mirrors [TeamsBotApplication.cs Router pattern](https://github.com/microsoft/teams.net/blob/next/core/core/src/Microsoft.Teams.Bot.Apps/TeamsBotApplication.cs).
3. **Type safety**: Return type is `InvokeResponse`, not void.

---

## API Surface

### .NET

```csharp
// Handler registration (specific invoke names)
app.OnInvoke("adaptiveCard/action", async (context, cancellationToken) => {
    var data = context.Activity.Value;
    // Process card action
    return new InvokeResponse(200, new { message = "Action processed" });
});

app.OnInvoke("task/fetch", async (context, cancellationToken) => {
    // Return task module UI
    return new InvokeResponse(200, new { task = taskInfo });
});

// Catch-all invoke handler (optional)
app.OnInvoke(async (context, cancellationToken) => {
    // Handle any invoke not registered above
    return new InvokeResponse(501); // Not Implemented
});

// InvokeResponse class
public class InvokeResponse
{
    public int Status { get; }
    public object? Body { get; }
    
    public InvokeResponse(int status, object? body = null)
    {
        Status = status;
        Body = body;
    }
}
```

**Handler signature:**
```csharp
Func<TurnContext, CancellationToken, Task<InvokeResponse>>
```

### Node.js

```typescript
// Handler registration (specific invoke names)
app.onInvoke('adaptiveCard/action', async (ctx) => {
    const data = ctx.activity.value;
    // Process card action
    return { status: 200, body: { message: 'Action processed' } };
});

app.onInvoke('task/fetch', async (ctx) => {
    // Return task module UI
    return { status: 200, body: { task: taskInfo } };
});

// Catch-all invoke handler (optional)
app.onInvoke(async (ctx) => {
    // Handle any invoke not registered above
    return { status: 501 }; // Not Implemented
});

// InvokeResponse interface
interface InvokeResponse {
    status: number;
    body?: any;
}
```

**Handler signature:**
```typescript
(ctx: TurnContext) => Promise<InvokeResponse>
```

### Python

```python
# Handler registration (specific invoke names)
@app.on_invoke("adaptiveCard/action")
async def on_card_action(ctx: TurnContext) -> InvokeResponse:
    data = ctx.activity.value
    # Process card action
    return InvokeResponse(status=200, body={"message": "Action processed"})

@app.on_invoke("task/fetch")
async def on_task_fetch(ctx: TurnContext) -> InvokeResponse:
    # Return task module UI
    return InvokeResponse(status=200, body={"task": task_info})

# Catch-all invoke handler (optional)
@app.on_invoke()
async def on_invoke_fallback(ctx: TurnContext) -> InvokeResponse:
    # Handle any invoke not registered above
    return InvokeResponse(status=501)  # Not Implemented

# InvokeResponse class
@dataclass
class InvokeResponse:
    status: int
    body: Any | None = None
```

**Handler signature:**
```python
async def handler(ctx: TurnContext) -> InvokeResponse
```

---

## Dispatch Rules

### 1. Specific Invoke Handlers

When `activity.type === "invoke"` and `activity.name` matches a registered handler:

```
activity.type = "invoke"
activity.name = "adaptiveCard/action"

→ Dispatch to handler registered with onInvoke("adaptiveCard/action", ...)
→ Return InvokeResponse { status: 200, body: {...} }
→ HTTP Response: status 200, body {...}
```

### 2. Catch-All Invoke Handler

When `activity.type === "invoke"` and NO specific handler is registered:

```
activity.type = "invoke"
activity.name = "unknown/operation"

→ Dispatch to catch-all handler registered with onInvoke(handler) (if present)
→ Return InvokeResponse { status: 501 }
→ HTTP Response: status 501, no body
```

### 3. No Invoke Handler

When `activity.type === "invoke"` and NO handlers (specific or catch-all) are registered:

```
activity.type = "invoke"
activity.name = "unknown/operation"

→ No invoke handler registered
→ HTTP Response: 200, body {}
```

When specific invoke handlers ARE registered but the incoming `activity.name` does NOT match any of them (and no catch-all is set):

```
activity.type = "invoke"
activity.name = "unknown/operation"

→ No matching specific handler
→ Return InvokeResponse { status: 501 }
→ HTTP Response: status 501, no body
```

> **Rationale**: When a bot has registered specific invoke handlers, an unrecognized invoke name likely indicates a misconfiguration or version mismatch — returning 501 signals this clearly. When no invoke handlers exist at all, the bot simply doesn't handle invoke activities, so the default 200 `{}` applies.

### 4. Conflict Prevention

**Rule**: A bot MUST NOT register both specific invoke handlers AND a catch-all invoke handler.

| Registration Order | Result |
|-------------------|--------|
| Specific handler first → Catch-all handler | Error: "Cannot register catch-all when specific handlers exist" |
| Catch-all handler first → Specific handler | Error: "Cannot register specific handler when catch-all exists" |

**Rationale**: Prevents ambiguous dispatch. Developer must choose one pattern.

---

## HTTP Integration

Invoke handlers return an `InvokeResponse` object. The framework translates this to an HTTP response:

```
InvokeResponse { status: 200, body: { result: "ok" } }

→ HTTP Response
   Status: 200 OK
   Content-Type: application/json
   Body: {"result":"ok"}
```

```
InvokeResponse { status: 501 }

→ HTTP Response
   Status: 501 Not Implemented
   (no body)
```

### Framework Responsibilities

The framework MUST:
1. Capture the returned `InvokeResponse`.
2. Set the HTTP response status to `invokeResponse.status`.
3. If `invokeResponse.body` is non-null/non-undefined, serialize it as JSON and write to response body.
4. If `invokeResponse.body` is null/undefined, send no response body.

---

## Middleware Behavior

Invoke activities flow through the middleware pipeline like all other activities:

```
POST /api/messages (invoke activity)
  └─ JWT validation
      └─ Middleware chain (registration order)
          └─ Invoke handler dispatch (by activity.name)
              └─ Return InvokeResponse
```

Middleware can:
- Inspect/modify invoke activities before handler dispatch
- Short-circuit by NOT calling `next()` (must handle HTTP response manually)
- Perform post-processing after handler execution

### CatchAll Handler Interaction

When a CatchAll handler (`OnActivity` / `onActivity` / `on_activity`) is set, **invoke activities bypass invoke-specific dispatch** and are routed to the CatchAll handler like all other activity types. The CatchAll handler replaces ALL dispatch — including invoke dispatch by `activity.name`. If the CatchAll handler needs to return an `InvokeResponse`, it must do so via the framework's invoke response mechanism (e.g., returning from `processBody` or setting the response on the HTTP context).

---

## Error Handling

### Handler Exception

If an invoke handler throws an exception:

```
Handler throws Error("Card validation failed")

→ Wrap in BotHandlerException
→ HTTP Response: 500 Internal Server Error
```

This matches existing error-wrapping behavior for all activity handlers.

### Missing Handler Return Value

If an invoke handler does NOT return an `InvokeResponse`:

```typescript
// BAD: No return value
app.onInvoke('task/fetch', async (ctx) => {
    console.log('Task fetch received');
    // Forgot to return InvokeResponse
});

→ Framework SHOULD throw error or return default InvokeResponse { status: 500 }
```

**Recommended**: Return `InvokeResponse { status: 500 }` with error details in logs.

---

## Example JSON Payloads

### Adaptive Card Action

**Inbound:**
```json
{
  "type": "invoke",
  "name": "adaptiveCard/action",
  "id": "f:abc123",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "serviceUrl": "https://smba.trafficmanager.net/amer/",
  "channelId": "msteams",
  "from": {
    "id": "29:user-id",
    "name": "Alice"
  },
  "conversation": {
    "id": "19:meeting-id"
  },
  "value": {
    "action": {
      "type": "Action.Submit",
      "id": "submitAction",
      "data": {
        "userId": "user123",
        "choice": "approve"
      }
    }
  }
}
```

**Handler:**
```typescript
app.onInvoke('adaptiveCard/action', async (ctx) => {
    const data = ctx.activity.value.action.data;
    if (data.choice === 'approve') {
        // Process approval
        return { status: 200, body: { message: 'Approved!' } };
    }
    return { status: 400, body: { error: 'Invalid choice' } };
});
```

### Task Module Fetch

**Inbound:**
```json
{
  "type": "invoke",
  "name": "task/fetch",
  "id": "f:def456",
  "from": { "id": "29:user-id" },
  "value": {
    "commandId": "showDetails",
    "context": { "itemId": "item-789" }
  }
}
```

**Handler:**
```typescript
app.onInvoke('task/fetch', async (ctx) => {
    return {
        status: 200,
        body: {
            task: {
                type: 'continue',
                value: {
                    title: 'Item Details',
                    url: 'https://example.com/details/item-789',
                    height: 400,
                    width: 600
                }
            }
        }
    };
});
```

---

## Cross-Language Parity Table

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Register specific handler | `app.OnInvoke("name", handler)` | `app.onInvoke('name', handler)` | `@app.on_invoke("name")` decorator or `app.on_invoke("name", handler)` |
| Register catch-all handler | `app.OnInvoke(handler)` | `app.onInvoke(handler)` | `@app.on_invoke()` decorator or `app.on_invoke(handler)` |
| Handler signature | `Func<TurnContext, CancellationToken, Task<InvokeResponse>>` | `(ctx: TurnContext) => Promise<InvokeResponse>` | `async def(ctx: TurnContext) -> InvokeResponse` |
| Return type | `InvokeResponse` class | `InvokeResponse` interface | `InvokeResponse` dataclass |
| Response fields | `Status: int, Body: object?` | `status: number, body?: any` | `status: int, body: Any \| None` |
| Conflict detection | Exception on registration | Exception on registration | Exception on registration |
| Default response (no invoke handlers at all) | HTTP 200, body `{}` | HTTP 200, body `{}` | HTTP 200, body `{}` |
| Unmatched name (handlers exist, no match) | HTTP 501 | HTTP 501 | HTTP 501 |

---

## Implementation Notes

### .NET

- Add `OnInvoke(string name, Func<TurnContext, CancellationToken, Task<InvokeResponse>> handler)` overload
- Add `OnInvoke(Func<TurnContext, CancellationToken, Task<InvokeResponse>> handler)` catch-all overload
- Create `InvokeResponse` class in `Botas` namespace
- Modify `BotApplication` to dispatch by `activity.Name` when `activity.Type == "invoke"`
- Enforce conflict rule: specific XOR catch-all, not both
- In HTTP integration layer, read `InvokeResponse.Status` and `InvokeResponse.Body`, set HTTP response accordingly

### Node.js

- Add `onInvoke(name: string, handler: InvokeHandler)` method
- Add `onInvoke(handler: InvokeHandler)` catch-all overload
- Create `InvokeResponse` interface
- Modify `BotApplication` to store invoke handlers separately from regular activity handlers
- Enforce conflict rule in registration methods
- In Express/Hono middleware, check if handler returned `InvokeResponse`, set `res.status()` and `res.json()`

### Python

- Add `on_invoke(name: str | None = None)` decorator supporting both specific and catch-all
- Add `on_invoke(name: str, handler: InvokeHandler)` method overload
- Create `InvokeResponse` dataclass
- Modify `BotApplication` to dispatch invoke activities by `activity.name`
- Enforce conflict rule in registration methods
- In FastAPI route handler, check if handler returned `InvokeResponse`, construct `JSONResponse(status_code=..., content=...)`

---

## References

- [teams.net TeamsBotApplication.cs](https://github.com/microsoft/teams.net/blob/next/core/core/src/Microsoft.Teams.Bot.Apps/TeamsBotApplication.cs) — Reference implementation
- [teams.net Router.cs](https://github.com/microsoft/teams.net/blob/next/core/core/src/Microsoft.Teams.Bot.Apps/Routing/Router.cs) — Invoke dispatch logic
- [Bot Framework Invoke Activities](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-activities#invoke-activity) — Protocol documentation
- [Teams Adaptive Cards Actions](https://learn.microsoft.com/microsoftteams/platform/task-modules-and-cards/cards/cards-actions) — Common invoke scenarios
