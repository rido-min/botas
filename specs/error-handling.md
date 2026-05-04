# Error Handling Spec

**Purpose**: Define error-handling behavior across all language ports of `botas` — what gets wrapped, what gets propagated, what HTTP status code is returned, and how errors become visible to developers.
**Status**: Draft

This spec consolidates behavior that is referenced from [`protocol.md`](./protocol.md) and complements the future [`onTurnError` proposal](./future/on-turn-error.md).

---

## Overview

Errors that flow through a bot fall into two distinct categories:

| Category | Examples | HTTP response | Wrapped? |
|----------|----------|---------------|----------|
| **Pre-handler errors** | Missing/invalid JWT, malformed JSON, missing required fields, body too large | `400`, `401`, `413` | No — raised directly |
| **Turn errors** | Handler exception, middleware exception, dispatch failure | `500` | Yes — wrapped in `BotHandlerException` |

Pre-handler errors are produced by the framework adapter (Express, FastAPI, ASP.NET) **before** the activity reaches the middleware pipeline. Turn errors originate inside user-supplied middleware or handlers and are caught and wrapped by `BotApplication` itself.

---

## Error Wrapping

Every exception raised inside a registered handler (per-type, CatchAll, or invoke) MUST be wrapped in a language-specific `BotHandlerException`. The wrapper carries:

- A human-readable message (e.g., `Handler for "message" threw an error`).
- The original exception as its inner `cause`.
- The `CoreActivity` being processed when the error occurred.

| Language | Wrapper type | File / line |
|----------|--------------|-------------|
| .NET | `BotHandlerException : Exception` (carries `Activity`) | [`dotnet/src/Botas/BotApplication.cs:15`](../dotnet/src/Botas/BotApplication.cs#L15) |
| Node.js | `class BotHandlerException extends Error` (carries `cause`, `activity`) | [`node/packages/botas-core/src/bot-application.ts:45`](../node/packages/botas-core/src/bot-application.ts#L45) |
| Python | `class BotHandlerException(Exception)` (carries `cause`, `activity`, sets `__cause__`) | [`python/packages/botas/src/botas/bot_application.py:88`](../python/packages/botas/src/botas/bot_application.py#L88) |

### Where wrapping happens

| Language | Per-type / CatchAll handler | Invoke handler | Pipeline-level rewrap |
|----------|-----------------------------|----------------|------------------------|
| .NET | Re-throws original from `DispatchToHandler` ([`BotApplication.cs:299`](../dotnet/src/Botas/BotApplication.cs#L299)); top-level `try/catch` in `ProcessAsync` wraps any non-`BotHandlerException`, non-`OperationCanceledException` exception ([`BotApplication.cs:229–241`](../dotnet/src/Botas/BotApplication.cs#L229)) | `DispatchInvokeHandler` wraps directly ([`BotApplication.cs:338`](../dotnet/src/Botas/BotApplication.cs#L338)) | Yes — the outer `catch` in `ProcessAsync` |
| Node.js | `handleCoreActivityAsync` wraps directly ([`bot-application.ts:286`](../node/packages/botas-core/src/bot-application.ts#L286)) | `dispatchInvokeAsync` wraps directly ([`bot-application.ts:312`](../node/packages/botas-core/src/bot-application.ts#L312)) | No — `runPipelineAsync` re-throws `BotHandlerException` as-is and lets middleware errors propagate unwrapped ([`bot-application.ts:357`](../node/packages/botas-core/src/bot-application.ts#L357)) |
| Python | `_handle_activity_async` wraps directly ([`bot_application.py:347`](../python/packages/botas/src/botas/bot_application.py#L347)) | `_dispatch_invoke_async` wraps directly ([`bot_application.py:371`](../python/packages/botas/src/botas/bot_application.py#L371)) | No — pipeline lets the wrapped exception propagate |

### Cancellation exceptions are never wrapped

| Language | Exception type | Behavior |
|----------|----------------|----------|
| .NET | `OperationCanceledException` | Re-thrown unwrapped ([`BotApplication.cs:231–234`](../dotnet/src/Botas/BotApplication.cs#L231)) |
| Node.js | `AbortError` / `DOMException('AbortError')` | Should propagate unwrapped (no special handling needed; not caught by handler `try` because aborts surface as cancellations of the `await`) |
| Python | `asyncio.CancelledError` | Falls outside the wrapping `except Exception` (since `CancelledError` is `BaseException` in 3.8+) |

---

## HTTP Response Codes

The codes below are produced by the **adapter layer** (`botas-express`, `botas-fastapi`, ASP.NET pipeline). `BotApplication` itself is web-agnostic — it raises typed exceptions or returns an `InvokeResponse`; the adapter translates that into HTTP.

| Code | When | Owner | Notes |
|------|------|-------|-------|
| **200** | Successful turn for non-invoke activities | Adapter | Body is `{}` (see [`protocol.md` §Response](./protocol.md#response)) |
| **200/4xx** | Invoke handler returned an `InvokeResponse` | Adapter | `status` and `body` come from the handler |
| **400** | Missing required fields (`type`, `serviceUrl`, `conversation.id`) or malformed JSON | Adapter | `.NET`: [`BotApplication.cs:158`](../dotnet/src/Botas/BotApplication.cs#L158) / `Node`: `ActivityValidationError` branch in [`bot-application.ts:193`](../node/packages/botas-core/src/bot-application.ts#L193) / `Python`: [`bot_app.py:131`](../python/packages/botas-fastapi/src/botas_fastapi/bot_app.py#L131) |
| **401** | JWT validation failed | Adapter (auth middleware) | Runs **before** any pipeline processing. See [`inbound-auth.md`](./inbound-auth.md). Python adapter: [`bot_app.py:114`](../python/packages/botas-fastapi/src/botas_fastapi/bot_app.py#L114). |
| **405** | Wrong HTTP method on `/api/messages` | Adapter | Express: [`bot-app.ts:130`](../node/packages/botas-express/src/bot-app.ts#L130) / FastAPI: [`bot_app.py:141`](../python/packages/botas-fastapi/src/botas_fastapi/bot_app.py#L141) |
| **413** | Request body exceeds 1 MB | Adapter | Node: `RequestBodyTooLargeError` branch in [`bot-application.ts:190`](../node/packages/botas-core/src/bot-application.ts#L190); FastAPI: [`bot_app.py:124`](../python/packages/botas-fastapi/src/botas_fastapi/bot_app.py#L124) |
| **500** | Handler / middleware / pipeline exception | Adapter | The exception is wrapped in `BotHandlerException` (handler errors) or surfaces directly (middleware errors in Node). Body is implementation-defined (e.g., Node writes `Internal server error`). |
| **501** | Invoke activity received but no registered invoke handler matches `activity.name` | Library | Returned as `InvokeResponse { status: 501 }` from `BotApplication`. .NET: [`BotApplication.cs:341`](../dotnet/src/Botas/BotApplication.cs#L341) / Node: [`bot-application.ts:302`](../node/packages/botas-core/src/bot-application.ts#L302) / Python: [`bot_application.py:360`](../python/packages/botas/src/botas/bot_application.py#L360) |

> **Invoke special case**: when **no** invoke handlers are registered at all, .NET and Python return `200` (treating the activity as silently ignored, consistent with non-invoke types); only when handlers exist but none match the `name` is `501` returned. Node returns `501` whenever no handler matches, regardless of registration count. This is an existing intentional difference; see [`invoke-activities.md`](./invoke-activities.md).

---

## Error Visibility

A turn error always becomes an HTTP `500`, but how visible the underlying exception is to the developer differs by language.

| Language | Default visibility | Mechanism | Hook for custom handling |
|----------|--------------------|-----------|---------------------------|
| **.NET** | Visible | `BotHandlerException` propagates out of `ProcessAsync` to ASP.NET, which writes the standard error response and logs through `ILogger`. Errors are also logged at `Error` level inside `BotApplication` ([`BotApplication.cs:239`](../dotnet/src/Botas/BotApplication.cs#L239)). | Standard ASP.NET exception middleware / `IExceptionHandler` |
| **Python** | Visible | `process_body` raises `BotHandlerException`; the FastAPI adapter does not catch it, so Starlette renders a 500 and the traceback reaches stdout/`logging`. | FastAPI `exception_handler(BotHandlerException)` |
| **Node.js** | **Silent by default** | `processAsync` catches the error, writes `500`, and re-throws ([`bot-application.ts:188–203`](../node/packages/botas-core/src/bot-application.ts#L188)). The `botas-express` route swallows the re-thrown error with `.catch((err) => console.error(...))` ([`bot-app.ts:118`](../node/packages/botas-express/src/bot-app.ts#L118)). The library itself logs at `error` level via `getLogger()`, but the **default `debugLogger` only emits when `DEBUG=botas:*` is set** ([`docs-site/logging.md` §Built-in loggers](../docs-site/logging.md#built-in-loggers)). | None today — see [`future/on-turn-error.md`](./future/on-turn-error.md) for the proposed `onTurnError` callback |

> **Why Node is the odd one out**: the `Logger` abstraction defaults to `debugLogger`, which uses the `debug` package and is silent without the `DEBUG` env var. Combined with `botas-express` swallowing the `processAsync` rejection, an unhandled handler error produces no console output. .NET (`ILogger` writes to console/Application Insights by default) and Python (stdlib `logging` writes warnings to stderr by default once configured, and FastAPI prints tracebacks for uncaught exceptions) do not have this problem.

---

## Test Coverage Recommendations

Each port should cover, at minimum:

| Behavior | Suggested test |
|----------|----------------|
| Handler exception is wrapped in `BotHandlerException` | Verify `cause` is the original exception and `activity` is the activity passed in |
| CatchAll handler exception is wrapped | Same as above for the CatchAll path |
| Invoke handler exception is wrapped | Verify the message includes the invoke `name` |
| Middleware exception propagates with original message | Pipeline must not swallow / re-wrap middleware errors |
| Cancellation exception is **not** wrapped | Send a cancellation token / abort signal during a slow handler |
| `400` on missing required fields | Post activity missing `type`, `serviceUrl`, or `conversation.id` |
| `401` on invalid JWT | Adapter-level test |
| `413` on oversized body | Post a > 1 MB body |
| `501` on unknown invoke `name` (handlers exist) | Register one invoke handler, send another `name` |

Existing test references:

- **.NET**: `dotnet/tests/` (search for `BotHandlerException`)
- **Node**: [`bot-application.spec.ts`](../node/packages/botas-core/src/bot-application.spec.ts) §`BotHandlerException`, `processAsync re-throws BotHandlerException after writing 500`; [`security-fixes.spec.ts`](../node/packages/botas-core/src/security-fixes.spec.ts) `preserves BotHandlerException from handler through middleware`
- **Python**: [`test_bot_application.py`](../python/packages/botas/tests/test_bot_application.py) (search for `BotHandlerException`)

---

## References

- [`protocol.md`](./protocol.md) — HTTP contract; §Error Wrapping and §Response live there too
- [`inbound-auth.md`](./inbound-auth.md) — JWT validation and `401` semantics
- [`invoke-activities.md`](./invoke-activities.md) — invoke dispatch and `501` semantics
- [`future/on-turn-error.md`](./future/on-turn-error.md) — proposed `onTurnError` hook to fix Node's silent-error problem
- [`../docs-site/logging.md`](../docs-site/logging.md) — user-facing logger configuration (default loggers, log levels, `DEBUG=botas:*`)
