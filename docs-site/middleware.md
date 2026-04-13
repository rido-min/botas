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

Middleware lets you run cross-cutting logic — logging, telemetry, error handling, activity modification — on every incoming activity **before** (and **after**) it reaches your handler. Each middleware gets the chance to inspect or modify the activity, then decides whether to continue the pipeline by calling `next()`.

For a deep dive on the full turn pipeline (including JWT authentication and handler dispatch), see [Architecture](../specs/Architecture.md).

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

1. **Registration order** — middleware executes in the order you register it. Register authentication/validation middleware first.
2. **Short-circuiting** — if a middleware does *not* call `next()`, the rest of the pipeline (including the handler) is skipped.
3. **Pre- and post-processing** — code *before* `next()` runs on the way in; code *after* `next()` runs on the way out.
4. **Activity modification** — middleware can inspect or modify `context.activity` before calling `next()`.

---

## Common Use Cases

Here are practical reasons to use middleware:

| Use Case | Example |
|----------|---------|
| **Logging** | Log all incoming activities and response times for debugging and auditing. |
| **Activity filtering/modification** | Strip mentions, redact sensitive data, or normalize user input. |
| **Metrics & telemetry** | Count message types, measure handler latency, send to Application Insights. |
| **Authentication checks** | Validate user identity or conversation authorization beyond Bot Framework JWT. |
| **Rate limiting** | Throttle requests from a single user or conversation. |
| **Context enrichment** | Look up user profile, conversation state, and attach to context for handler use. |
| **Error recovery** | Wrap handlers in try/catch to send fallback messages on failure. |
| **Activity routing** | Redirect certain activity types to different handlers or external services. |

---

## Writing middleware

Every language has its own interface, but the shape is the same: you receive the turn context and a `next` callback.

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

Write middleware as a plain async function matching the `TurnMiddleware` type:

```typescript
import type { TurnMiddleware } from 'botas'

const loggingMiddleware: TurnMiddleware = async (context, next) => {
  console.log(`▶ Incoming: ${context.activity.type}`)
  await next()                                           // continue the pipeline
  console.log(`◀ Done: ${context.activity.type}`)
}
```

> `NextTurn` is `() => Promise<void>`.
{: .note }

### Python

Implement the `TurnMiddleware` protocol:

```python
from botas import TurnMiddleware
from botas.turn_context import TurnContext

class LoggingMiddleware(TurnMiddleware):
    async def on_turn(
        self,
        context: TurnContext,
        next,
    ) -> None:
        print(f"▶ Incoming: {context.activity.type}")
        await next()                                       # continue the pipeline
        print(f"◀ Done: {context.activity.type}")
```

> `NextTurn` is `Callable[[], Awaitable[None]]`.
{: .note }

---

## Registering middleware

Call `Use()` (**.NET**) or `use()` (**Node / Python**) on your `BotApplication` instance. You can chain multiple calls — they run in the order registered.

### .NET

```csharp
var app = BotApp.Create(args);

app.Use(new LoggingMiddleware());
app.Use(new ErrorHandlingMiddleware());
```

### Node.js

```typescript
const bot = new BotApplication()

bot
  .use(loggingMiddleware)
  .use(errorHandlingMiddleware)
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
        TurnContext context,
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
            await context.SendAsync("Sorry, something went wrong.", cancellationToken);
        }
    }
}
```

### Node.js

```typescript
import type { TurnMiddleware } from 'botas'

const errorHandlingMiddleware: TurnMiddleware = async (context, next) => {
  try {
    await next()
  } catch (err) {
    console.error('Error:', err)
    await context.send('Sorry, something went wrong.')
  }
}
```

### Python

```python
from botas import TurnMiddleware
from botas.turn_context import TurnContext

class ErrorHandlingMiddleware(TurnMiddleware):
    async def on_turn(
        self,
        context: TurnContext,
        next,
    ) -> None:
        try:
            await next()
        except Exception as exc:
            print(f"Error: {exc}")
            await context.send("Sorry, something went wrong.")
```

---

## Example: Short-circuit middleware

A middleware that filters out non-message activities by *not* calling `next()`:

### .NET

```csharp
public class MessagesOnlyMiddleware : ITurnMiddleWare
{
    public async Task OnTurnAsync(
        TurnContext context,
        NextDelegate next,
        CancellationToken cancellationToken = default)
    {
        if (context.Activity.Type == "message")
        {
            await next(cancellationToken);   // only messages reach the handler
        }
        // non-message activities are silently dropped
    }
}
```

### Node.js

```typescript
import type { TurnMiddleware } from 'botas'

const messagesOnly: TurnMiddleware = async (context, next) => {
  if (context.activity.type === 'message') {
    await next()                           // only messages reach the handler
  }
  // non-message activities are silently dropped
}
```

### Python

```python
class MessagesOnlyMiddleware(TurnMiddleware):
    async def on_turn(self, context, next) -> None:
        if context.activity.type == "message":
            await next()                     # only messages reach the handler
        # non-message activities are silently dropped
```

---

## Modifying the incoming activity

Yes, you can modify the activity inside middleware! The activity is passed to each middleware in the chain, so changes persist through the pipeline and reach the handler.

**How it works:**

- The `context.activity` object is mutable.
- Changes made to `context.activity` before calling `next()` are visible to downstream middleware and the handler.
- This is useful for normalizing input, stripping sensitive fields, or adding metadata.

### Example: Trimming and lowercasing message text

### .NET

```csharp
public class NormalizeTextMiddleware : ITurnMiddleWare
{
    public async Task OnTurnAsync(
        TurnContext context,
        NextDelegate next,
        CancellationToken cancellationToken = default)
    {
        if (context.Activity.Type == "message" && context.Activity.Text != null)
        {
            context.Activity.Text = context.Activity.Text.Trim().ToLower();
        }
        await next(cancellationToken);
    }
}
```

### Node.js

```typescript
import type { TurnMiddleware } from 'botas'

const normalizeText: TurnMiddleware = async (context, next) => {
  if (context.activity.type === 'message' && context.activity.text) {
    context.activity.text = context.activity.text.trim().toLowerCase()
  }
  await next()
}
```

### Python

```python
class NormalizeTextMiddleware(TurnMiddleware):
    async def on_turn(self, context: TurnContext, next) -> None:
        if context.activity.type == "message" and context.activity.text:
            context.activity.text = context.activity.text.strip().lower()
        await next()
```

---

## Example: Remove bot mention middleware

A common pattern: when a user mentions the bot in a group chat, you may want to remove the mention from the text before processing. This example shows the **RemoveMentionMiddleware** that strips the bot's mention text from the message.

### Use case

In a Teams channel where the bot is mentioned:
- **Before:** `@MyBot what's the weather?`
- **After (in handler):** `what's the weather?`

This makes your message handler logic simpler and more portable to other channels.

### How it works

The middleware:
1. Looks for the bot's ID: first tries `AppId` from config (the registered bot credential), falls back to `activity.recipient.id`
2. Iterates through the incoming activity's `entities` array
3. For each entity with `type: "mention"`, checks if the mentioned ID matches the bot's ID (case-insensitive)
4. If it matches, removes all occurrences of the mention text from the message (case-insensitive)
5. Trims and passes the modified activity downstream

### .NET

```csharp
public class RemoveMentionMiddleware : ITurnMiddleWare
{
    public Task OnTurnAsync(
        TurnContext context,
        NextDelegate next,
        CancellationToken cancellationToken = default)
    {
        RemoveRecipientMention(context);
        return next(cancellationToken);
    }

    private static void RemoveRecipientMention(TurnContext context)
    {
        var activity = context.Activity;
        if (activity.Entities is null || string.IsNullOrEmpty(activity.Text))
        {
            return;
        }

        // Get bot ID: prefer AppId, fall back to Recipient.Id
        string? botId = context.App.AppId ?? activity.Recipient?.Id;
        if (botId is null)
        {
            return;
        }

        foreach (var entity in activity.Entities)
        {
            if (entity is not JsonObject obj)
            {
                continue;
            }

            // Check if this is a mention entity
            string? entityType = obj["type"]?.GetValue<string>();
            if (!string.Equals(entityType, "mention", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var mentioned = obj["mentioned"]?.AsObject();
            if (mentioned is null)
            {
                continue;
            }

            // Check if the mention targets the bot
            string? mentionedId = mentioned["id"]?.GetValue<string>();
            if (!string.Equals(mentionedId, botId, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            // Remove the mention text (e.g. "<at>BotName</at>") from activity.text
            string? mentionText = obj["text"]?.GetValue<string>();
            if (!string.IsNullOrEmpty(mentionText))
            {
                activity.Text = activity.Text!
                    .Replace(mentionText, string.Empty, StringComparison.OrdinalIgnoreCase)
                    .Trim();
            }
        }
    }
}
```

### Node.js

```typescript
import type { TurnMiddleware, NextTurn } from 'botas'
import type { TurnContext } from 'botas'
import type { Entity } from 'botas'

interface MentionEntity extends Entity {
  type: 'mention'
  mentioned: { id: string; name?: string }
  text: string
}

function isMentionEntity (entity: Entity): entity is MentionEntity {
  return (
    entity.type === 'mention' &&
    typeof (entity as MentionEntity).mentioned?.id === 'string' &&
    typeof (entity as MentionEntity).text === 'string'
  )
}

function removeMentionMiddleware (): TurnMiddleware {
  return async (context: TurnContext, next: NextTurn): Promise<void> => {
    const { activity } = context

    if (activity.text && activity.entities?.length) {
      // Get bot ID from recipient
      const botId = activity.recipient?.id
      if (botId) {
        for (const entity of activity.entities) {
          if (isMentionEntity(entity) &&
              entity.mentioned.id.toLowerCase() === botId.toLowerCase()) {
            // Replace all occurrences of the mention text
            activity.text = activity.text
              .replaceAll(entity.text, '')
              .trim()
          }
        }
      }
    }

    await next()
  }
}
```

### Python

```python
import re
from typing import TYPE_CHECKING

from botas import TurnMiddleware
from botas.i_turn_middleware import NextTurn

if TYPE_CHECKING:
    from botas.turn_context import TurnContext


class RemoveMentionMiddleware(TurnMiddleware):
    async def on_turn(self, context: 'TurnContext', next: NextTurn) -> None:
        activity = context.activity
        if activity.text and activity.entities:
            # Get bot ID: prefer appid, fall back to recipient.id
            bot_id = context.app.appid or (
                activity.recipient.id if activity.recipient else None
            )
            if bot_id:
                for entity in activity.entities:
                    raw = entity.model_dump(by_alias=True)
                    if raw.get("type") != "mention":
                        continue

                    mentioned = raw.get("mentioned", {})
                    mentioned_id = mentioned.get("id", "")
                    mention_text = raw.get("text", "")

                    # Case-insensitive match and replace
                    if mentioned_id.casefold() == bot_id.casefold() and mention_text:
                        activity.text = re.sub(
                            re.escape(mention_text), "", activity.text, flags=re.IGNORECASE
                        ).strip()

        await next()
```

### Usage

Register the middleware before your message handler:

**.NET**

```csharp
var app = BotApp.Create(args);
app.Use(new RemoveMentionMiddleware());

app.On("message", async (ctx, ct) =>
{
    // ctx.Activity.Text no longer contains the @mention
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();
```

**Node.js**

```typescript
import { removeMentionMiddleware } from 'botas'

const bot = new BotApplication()

bot.use(removeMentionMiddleware())

bot.on('message', async (ctx) => {
  // ctx.activity.text no longer contains the @mention
  await ctx.send(`You said: ${ctx.activity.text}`)
})
```

**Python**

```python
bot = BotApplication()
bot.use(RemoveMentionMiddleware())

@bot.on("message")
async def on_message(ctx):
    # ctx.activity.text no longer contains the @mention
    await ctx.send(f"You said: {ctx.activity.text}")
```

---

| Concept | .NET | Node.js | Python |
|---|---|---|---|
| Type | `ITurnMiddleWare` | `TurnMiddleware` (function type) | `TurnMiddleware` (Protocol) |
| Method | `OnTurnAsync(context, next, ct)` | *(plain function)* `(context, next) => Promise<void>` | `on_turn(context, next)` |
| Next callback | `NextDelegate` (takes `CancellationToken`) | `NextTurn` (`() => Promise<void>`) | `NextTurn` (`Callable[[], Awaitable[None]]`) |
| Register | `bot.Use(mw)` | `bot.use(mw)` | `bot.use(mw)` |
| Chaining | returns `ITurnMiddleWare` | returns `this` | returns `BotApplication` |
