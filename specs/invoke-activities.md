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

2. **Catch-all invoke handler** — If no specific handler matches and a catch-all invoke handler is registered, dispatch to it.

3. **No invoke handlers at all** — If no invoke handlers (specific or catch-all) are registered, return HTTP 200 `{}` (the bot simply doesn't handle invokes).

4. **Specific handlers exist but no match** — If specific handlers ARE registered but `activity.name` doesn't match any (and no catch-all is set), return HTTP 501 (Not Implemented).

> **Rationale**: When a bot has registered specific invoke handlers, an unrecognized invoke name likely indicates a misconfiguration — returning 501 signals this clearly.

### Conflict Prevention

A bot MUST NOT register both specific invoke handlers AND a catch-all invoke handler.

| Registration Order | Result |
|-------------------|--------|
| Specific handler first → Catch-all handler | Error: "Cannot register catch-all when specific handlers exist" |
| Catch-all handler first → Specific handler | Error: "Cannot register specific handler when catch-all exists" |

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

When a CatchAll handler (`OnActivity` / `onActivity` / `on_activity`) is set, **invoke activities bypass invoke-specific dispatch** and are routed to the CatchAll handler like all other activity types. The CatchAll handler replaces ALL dispatch — including invoke dispatch by `activity.name`. If the CatchAll handler needs to return an `InvokeResponse`, it must do so via the framework's invoke response mechanism (e.g., returning from `processBody` or setting the response on the HTTP context).

> **Why CatchAll overrides invoke dispatch**: The CatchAll handler is an escape hatch for bots that want full control over all activity routing. CatchAll means "catch ALL".

### Quick Reference: Dispatch Decision Table

| Invoke handlers registered? | CatchAll set? | `activity.name` matches? | Result |
|-----------------------------|---------------|--------------------------|--------|
| None | No | — | **200 `{}`** (bot doesn't handle invokes) |
| None | Yes | — | **CatchAll handler** receives the activity |
| Specific only | No | Yes | **Matched handler** runs |
| Specific only | No | No | **501** (Not Implemented) |
| Catch-all invoke | No | — | **Catch-all invoke handler** runs |
| Any | Yes | — | **CatchAll handler** (invoke dispatch bypassed) |
| Specific + Catch-all invoke | — | — | **Error at registration** (conflict) |

---

## Error Handling

### Handler Exception

If an invoke handler throws an exception, it is wrapped in `BotHandlerException` (same as all activity handlers) and results in HTTP 500 Internal Server Error.

### Missing Handler Return Value

If an invoke handler does NOT return an `InvokeResponse`, the framework SHOULD return `InvokeResponse { status: 500 }` with error details in logs.

---

## References

- [teams.net TeamsBotApplication.cs](https://github.com/microsoft/teams.net/blob/next/core/core/src/Microsoft.Teams.Bot.Apps/TeamsBotApplication.cs) — Reference implementation
- [Bot Framework Invoke Activities](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-activities#invoke-activity) — Protocol documentation
- [Teams Adaptive Cards Actions](https://learn.microsoft.com/microsoftteams/platform/task-modules-and-cards/cards/cards-actions) — Common invoke scenarios
