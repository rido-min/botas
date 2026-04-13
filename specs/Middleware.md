# Middleware Spec

**Purpose**: Define how middleware is written, registered, and executed in the BotAS turn pipeline.
**Status**: Draft

> For a developer-oriented guide with more examples, see the [Middleware Guide](../docs-site/middleware.md). This document focuses on the formal specification.

---

## Overview

Middleware intercepts every incoming activity before it reaches the handler. Common uses include logging, error handling, activity filtering, and input normalization.

---

## Pipeline

```
HTTP POST /api/messages
  └─ JWT validation (401 on failure)
       └─ Middleware[0](context, next)
            └─ Middleware[1](context, next)
                 └─ ...
                      └─ Middleware[N](context, next)
                           └─ Handler dispatch (by activity.type)
```

---

## Rules

These rules are behavioral invariants that all implementations MUST follow:

1. **Registration order** — Middleware executes in the order it is registered via `Use()` / `use()`.
2. **Pre- and post-processing** — Code before `next()` runs on the way in; code after `next()` runs on the way out.
3. **Short-circuiting** — If a middleware does **not** call `next()`, all subsequent middleware and the handler are skipped.
4. **Activity modification** — Middleware MAY inspect or modify `context.activity`. Changes persist through the pipeline and reach the handler.
5. **Send from middleware** — Middleware MAY call `context.send()` before or after `next()`.
6. **Shared context** — The same `TurnContext` instance is passed to all middleware and the handler within a single turn.
7. **Exception propagation** — If a handler throws, the exception propagates back through the middleware chain (each middleware's `next()` call throws). Middleware MAY catch and handle exceptions.

---

## Interface

### .NET

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

### Node.js

```typescript
type NextTurn = () => Promise<void>

type TurnMiddleware = (context: TurnContext, next: NextTurn) => Promise<void>
```

> The legacy `ITurnMiddleware` interface (class with `onTurnAsync`) still exists as a deprecated alias.

### Python

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

---

## Registration

### .NET

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

### Node.js

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

### Python

```python
bot = BotApplication()
bot.use(LoggingMiddleware())
bot.use(ErrorHandlingMiddleware())
```

---

## Execution Order Example

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

---

## Patterns

### Logging

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

### Error Handling

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

### Short-Circuiting (Filter)

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

### Activity Modification

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

### Remove Bot Mention

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

---

## Interaction with CatchAll Handler

When a CatchAll handler (`OnActivity` / `onActivity` / `on_activity`) is set, middleware still executes normally. The CatchAll replaces per-type dispatch at the end of the pipeline — it does not bypass middleware.

```
Middleware[0] → Middleware[1] → ... → CatchAll handler
```

See [Protocol — CatchAll Handler](./protocol.md#catchall-handler).

---

## Cross-Language Reference

| Concept | .NET | Node.js | Python |
|---------|------|---------|--------|
| Type | `ITurnMiddleWare` | `TurnMiddleware` (function type) | `TurnMiddleware` (Protocol) |
| Method | `OnTurnAsync(context, next, ct)` | *(plain function)* `(context, next) => Promise<void>` | `on_turn(context, next)` |
| Next callback | `NextDelegate(CancellationToken)` | `NextTurn: () => Promise<void>` | `NextTurn: Callable[[], Awaitable[None]]` |
| Register | `bot.Use(mw)` | `bot.use(mw)` | `bot.use(mw)` |

---

## References

- [Protocol — Middleware](./protocol.md#middleware) — formal middleware contract
- [Architecture — Turn Pipeline](./Architecture.md#turn-pipeline) — where middleware fits
- [Middleware Guide](../docs-site/middleware.md) — developer-oriented guide with more examples
- [Turn Context](./turn-context.md) — the `TurnContext` object passed to middleware
