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

1. **Specific handler match** — If `activity.name` matches a registered handler, dispatch to it. The handler returns an `InvokeResponse { status, body? }` which the framework translates to the HTTP response.

2. **No handler match** — If `activity.name` doesn't match any registered handler (or no handlers are registered at all), return HTTP 501 (Not Implemented).

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
| None | No | — | **501** (Not Implemented) |
| None | Yes | — | **501** (invoke bypasses CatchAll) |
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

## References

- [teams.net TeamsBotApplication.cs](https://github.com/microsoft/teams.net/blob/next/core/core/src/Microsoft.Teams.Bot.Apps/TeamsBotApplication.cs) — Reference implementation
- [Bot Service Invoke Activities](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-activities#invoke-activity) — Protocol documentation
- [Teams Adaptive Cards Actions](https://learn.microsoft.com/microsoftteams/platform/task-modules-and-cards/cards/cards-actions) — Common invoke scenarios
