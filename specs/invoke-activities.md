# Invoke Activities Spec

**Purpose**: Define how `botas` handles invoke activities and dispatches by `activity.name`.  
**Status**: Implemented (PR #79)

---

## Overview

Invoke activities are request-response style messages used in Microsoft Teams for adaptive card actions, message extensions, task modules, sign-in verification, and file consent. Unlike regular activity types which are fire-and-forget, **invoke activities require a synchronous HTTP response** with a status code and optional JSON body.

`botas` provides **hierarchical dispatch** for invoke activities — register handlers by full invoke name (e.g., `adaptiveCard/action`), with optional catch-all fallback. Per-language API details are in `specs/reference/`.

---

## Dispatch Rules

When `activity.type === "invoke"`:

1. **Specific handler match** — If `activity.name` matches a registered handler, dispatch to it. The handler returns an `InvokeResponse { status, body? }` which the framework translates to the HTTP response. **Invoke name matching MUST be case-insensitive.** Implementations SHOULD normalize invoke names to lowercase on registration.

2. **No handler match** — If `activity.name` doesn't match any registered handler, return HTTP 501 (Not Implemented).

3. **No invoke handlers registered at all** — If no invoke handlers have been registered AND no CatchAll handler is set, the bot does not implement invoke. Return HTTP 200 with an empty body `{}` to acknowledge receipt without error. This distinguishes "bot doesn't use invoke" (200) from "unrecognized invoke name" (501).

> **Rationale**: Invoke activities require a synchronous response. Returning 501 when no handler is registered signals to the channel that the bot doesn't implement the requested invoke operation.

---

## HTTP Integration

Invoke handlers return an `InvokeResponse` object. The framework translates this to an HTTP response.

### Framework Responsibilities

The framework MUST:
1. Capture the returned `InvokeResponse`.
2. Set the HTTP response status to `invokeResponse.status`.
3. If `invokeResponse.body` is non-null/non-undefined, serialize it as JSON and write to response body.
4. If `invokeResponse.body` is null/undefined, send no response body.

---

## Middleware Behavior

Invoke activities flow through the middleware pipeline like all other activities. Middleware can inspect/modify invoke activities, short-circuit by not calling `next()`, or perform post-processing.

### CatchAll Handler Interaction

**Invoke activities ALWAYS bypass the CatchAll handler** (`OnActivity` / `onActivity` / `on_activity`) and go directly to invoke-specific dispatch by `activity.name`. This ensures that invoke handlers can return an `InvokeResponse` object, which is required for the synchronous HTTP response contract.

> **Why invoke bypasses CatchAll**: Invoke activities have a different return contract than fire-and-forget activities. Invoke handlers must return an `InvokeResponse` with an HTTP status code and optional body. The CatchAll handler signature doesn't support this return type, so invoke activities are routed separately.

### Quick Reference: Dispatch Decision Table

| Invoke handlers registered? | CatchAll set? | `activity.name` matches? | Result |
|-----------------------------|---------------|--------------------------|--------|
| None | No | — | **200** with `{}` (bot doesn't use invoke) |
| None | Yes | — | **200** with `{}` (invoke bypasses CatchAll) |
| Specific only | No | Yes | **Matched handler** runs |
| Specific only | No | No | **501** (Not Implemented) |
| Specific only | Yes | Yes | **Matched handler** (invoke bypasses CatchAll) |
| Specific only | Yes | No | **501** (invoke bypasses CatchAll) |

---

## Error Handling

### Handler Exception

If an invoke handler throws an exception, it is wrapped in `BotHandlerException` (same as all activity handlers) and results in HTTP 500 Internal Server Error.

### Missing Handler Return Value

If an invoke handler does NOT return an `InvokeResponse`, the framework SHOULD return `InvokeResponse { status: 500 }` with error details in logs.

---

## Action.Submit vs Action.Execute

Adaptive Cards support two action types that bots must handle differently:

### Action.Execute (invoke activity)

`Action.Execute` sends an **invoke** activity (`type: "invoke"`, `name: "adaptiveCard/action"`) containing the `verb` and `data` in `activity.value.action`. This is a request-response pattern — the handler **must** return an `InvokeResponse` with a status code and optional body (typically an updated card).

```
Card (Action.Execute with verb + data)
  → User clicks button
    → Teams sends invoke activity (name="adaptiveCard/action")
      → Bot invoke handler returns InvokeResponse (updated card)
```

### Action.Submit (message activity)

`Action.Submit` sends a **message** activity (`type: "message"`) with `activity.value` set to the card's data payload and `activity.text` empty or absent. This is a fire-and-forget pattern — no synchronous response is expected. The bot detects a card submit by checking for `value` present + `text` empty within its message handler.

```
Card (Action.Submit with data)
  → User clicks button
    → Teams sends message activity (value={...}, text="")
      → Bot message handler detects value + no text → processes submit
```

### Detection Pattern

All three languages use the same detection logic inside the message handler:

| Language | Detection |
|----------|-----------|
| .NET | `activity.Value is not null && string.IsNullOrWhiteSpace(activity.Text)` |
| Node.js | `ctx.activity.value && !ctx.activity.text` |
| Python | `ctx.activity.value is not None and not ctx.activity.text` |

### When to Use Which

| Action Type | Use case | Activity type | Return contract |
|-------------|----------|---------------|-----------------|
| `Action.Execute` | Update the card in-place, task modules, sign-in | `invoke` | `InvokeResponse` (required) |
| `Action.Submit` | Simple form submission, fire-and-forget data collection | `message` | None (fire-and-forget) |

> **Tip**: Prefer `Action.Execute` when the bot needs to update the card or return a structured response. Use `Action.Submit` for simple data collection where the bot just needs the submitted values.

---

## References

- [teams.net TeamsBotApplication.cs](https://github.com/microsoft/teams.net/blob/next/core/core/src/Microsoft.Teams.Bot.Apps/TeamsBotApplication.cs) — Reference implementation
- [Bot Service Invoke Activities](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-activities#invoke-activity) — Protocol documentation
- [Teams Adaptive Cards Actions](https://learn.microsoft.com/microsoftteams/platform/task-modules-and-cards/cards/cards-actions) — Common invoke scenarios
