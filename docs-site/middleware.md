---
layout: default
title: Middleware
nav_order: 4
---

# Middleware
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## What is middleware?

Middleware lets you run cross-cutting logic — logging, telemetry, error handling — on every incoming activity **before** (and **after**) it reaches your handler. Each middleware gets the chance to inspect or modify the activity, then decides whether to continue the pipeline by calling `next()`.

For a deep dive on the full turn pipeline (including JWT authentication and handler dispatch), see [Architecture](../docs/Architecture.md).

---

## The turn pipeline

When an activity arrives at your bot, it flows through this pipeline:

```
  HTTP POST /api/messages
    │
    ▼
  ┌──────────────────────────┐
  │  Auth (JWT validation)   │  ← rejects unauthenticated requests (401)
  └────────────┬─────────────┘
               ▼
  ┌──────────────────────────┐
  │  Middleware[0]           │──┐
  │    calls next() ──────►  │  │
  └──────────────────────────┘  │
  ┌──────────────────────────┐  │  registration
  │  Middleware[1]           │  │  order
  │    calls next() ──────►  │  │
  └──────────────────────────┘  │
               ⋮                │
  ┌──────────────────────────┐  │
  │  Middleware[N]           │──┘
  │    calls next() ──────►  │
  └────────────┬─────────────┘
               ▼
  ┌──────────────────────────┐
  │  Handler dispatch        │  ← calls the handler registered for activity.type
  │  (silently ignores       │    (unregistered types produce no error)
  │   unregistered types)    │
  └──────────────────────────┘
```

**Key rules:**

1. **Registration order** — middleware executes in the order you register it.
2. **Short-circuiting** — if a middleware does *not* call `next()`, the rest of the pipeline (including the handler) is skipped.
3. **Pre- and post-processing** — code *before* `next()` runs on the way in; code *after* `next()` runs on the way out.

---

## Writing middleware

Every language has its own interface, but the shape is the same: you receive the bot application, the incoming activity, and a `next` callback.

### .NET

Implement `ITurnMiddleWare` and its `OnTurnAsync` method:

```csharp
using Botas;

public class LoggingMiddleware : ITurnMiddleWare
{
    public async Task OnTurnAsync(
        BotApplication app,
        CoreActivity activity,
        NextDelegate next,
        CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"▶ Incoming: {activity.Type}");
        await next(cancellationToken);                     // continue the pipeline
        Console.WriteLine($"◀ Done: {activity.Type}");
    }
}
```

> `NextDelegate` is `Task NextDelegate(CancellationToken cancellationToken)`.
{: .note }

### Node.js (TypeScript)

Implement the `ITurnMiddleware` interface:

```typescript
import type { ITurnMiddleware, NextTurn } from 'botas'
import type { CoreActivity } from 'botas'

class LoggingMiddleware implements ITurnMiddleware {
  async onTurnAsync(
    app: unknown,
    activity: CoreActivity,
    next: NextTurn
  ): Promise<void> {
    console.log(`▶ Incoming: ${activity.type}`)
    await next()                                           // continue the pipeline
    console.log(`◀ Done: ${activity.type}`)
  }
}
```

> `NextTurn` is `() => Promise<void>`.
{: .note }

### Python

Implement the `ITurnMiddleware` protocol:

```python
from botas import BotApplication, CoreActivity
from botas.i_turn_middleware import ITurnMiddleware, NextTurn

class LoggingMiddleware(ITurnMiddleware):
    async def on_turn_async(
        self,
        app: BotApplication,
        activity: CoreActivity,
        next: NextTurn,
    ) -> None:
        print(f"▶ Incoming: {activity.type}")
        await next()                                       # continue the pipeline
        print(f"◀ Done: {activity.type}")
```

> `NextTurn` is `Callable[[], Awaitable[None]]`.
{: .note }

---

## Registering middleware

Call `Use()` (**.NET**) or `use()` (**Node / Python**) on your `BotApplication` instance. You can chain multiple calls — they run in the order registered.

### .NET

```csharp
var bot = app.UseBotApplication<BotApplication>();

bot.Use(new LoggingMiddleware());
bot.Use(new ErrorHandlingMiddleware());
```

### Node.js

```typescript
const bot = new BotApplication()

bot
  .use(new LoggingMiddleware())
  .use(new ErrorHandlingMiddleware())
```

### Python

```python
bot = BotApplication()

bot.use(LoggingMiddleware())
bot.use(ErrorHandlingMiddleware())
```

---

## Example: Error-handling middleware

Wrap the downstream pipeline in a try/catch to handle errors centrally.

### .NET

```csharp
public class ErrorHandlingMiddleware : ITurnMiddleWare
{
    public async Task OnTurnAsync(
        BotApplication app,
        CoreActivity activity,
        NextDelegate next,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await next(cancellationToken);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            var reply = activity.CreateReplyActivity("Sorry, something went wrong.");
            await app.SendActivityAsync(reply, cancellationToken);
        }
    }
}
```

### Node.js

```typescript
import type { ITurnMiddleware, NextTurn } from 'botas'
import { createReplyActivity, type CoreActivity, type BotApplication } from 'botas'

class ErrorHandlingMiddleware implements ITurnMiddleware {
  async onTurnAsync(app: unknown, activity: CoreActivity, next: NextTurn): Promise<void> {
    try {
      await next()
    } catch (err) {
      console.error('Error:', err)
      const bot = app as BotApplication
      await bot.sendActivityAsync(
        activity.serviceUrl,
        activity.conversation.id,
        createReplyActivity(activity, 'Sorry, something went wrong.')
      )
    }
  }
}
```

### Python

```python
from botas import BotApplication, CoreActivity
from botas.core_activity import create_reply_activity
from botas.i_turn_middleware import ITurnMiddleware, NextTurn

class ErrorHandlingMiddleware(ITurnMiddleware):
    async def on_turn_async(
        self,
        app: BotApplication,
        activity: CoreActivity,
        next: NextTurn,
    ) -> None:
        try:
            await next()
        except Exception as exc:
            print(f"Error: {exc}")
            reply = create_reply_activity(activity, "Sorry, something went wrong.")
            await app.send_activity_async(
                activity.service_url, activity.conversation.id, reply
            )
```

---

## Example: Short-circuit middleware

A middleware that filters out non-message activities by *not* calling `next()`:

### .NET

```csharp
public class MessagesOnlyMiddleware : ITurnMiddleWare
{
    public async Task OnTurnAsync(
        BotApplication app,
        CoreActivity activity,
        NextDelegate next,
        CancellationToken cancellationToken = default)
    {
        if (activity.Type == "message")
        {
            await next(cancellationToken);   // only messages reach the handler
        }
        // non-message activities are silently dropped
    }
}
```

### Node.js

```typescript
class MessagesOnlyMiddleware implements ITurnMiddleware {
  async onTurnAsync(app: unknown, activity: CoreActivity, next: NextTurn): Promise<void> {
    if (activity.type === 'message') {
      await next()                           // only messages reach the handler
    }
    // non-message activities are silently dropped
  }
}
```

### Python

```python
class MessagesOnlyMiddleware(ITurnMiddleware):
    async def on_turn_async(self, app, activity, next) -> None:
        if activity.type == "message":
            await next()                     # only messages reach the handler
        # non-message activities are silently dropped
```

---

## Summary

| Concept | .NET | Node.js | Python |
|---|---|---|---|
| Interface | `ITurnMiddleWare` | `ITurnMiddleware` | `ITurnMiddleware` (Protocol) |
| Method | `OnTurnAsync(app, activity, next, ct)` | `onTurnAsync(app, activity, next)` | `on_turn_async(app, activity, next)` |
| Next callback | `NextDelegate` (takes `CancellationToken`) | `NextTurn` (`() => Promise<void>`) | `NextTurn` (`Callable[[], Awaitable[None]]`) |
| Register | `bot.Use(mw)` | `bot.use(mw)` | `bot.use(mw)` |
| Chaining | returns `ITurnMiddleWare` | returns `this` | returns `BotApplication` |
