# TurnContext Spec

**Purpose**: Define the `TurnContext` object passed to activity handlers and middleware.  
**Status**: Draft

---

## Overview

`TurnContext` is the context object for a single activity turn. It provides:
- The incoming activity being processed
- A reference to the bot application
- Helper methods to send replies without manually constructing routing fields

Every handler and middleware function receives a `TurnContext` instance. The same instance flows through the entire middleware pipeline and into the final handler.

---

## Constructor

**Signature** (conceptual — language-specific details below):

```
TurnContext(app: BotApplication, activity: CoreActivity)
```

Implementations construct `TurnContext` internally when processing an activity. Application code does not call this constructor directly.

---

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `activity` / `Activity` | `CoreActivity` | The incoming activity being processed (immutable). |
| `app` / `App` | `BotApplication` | The bot application instance handling this turn. |

**Naming conventions**:
- .NET: PascalCase (`Activity`, `App`)
- Node.js / Python: camelCase / snake_case (`activity`, `app`)

---

## Methods

### Send Reply

Sends a reply to the conversation that originated the current turn. Routing fields are automatically populated.

**.NET:**

```csharp
Task<string> SendAsync(string text, CancellationToken cancellationToken = default)
Task<string> SendAsync(CoreActivity activity, CancellationToken cancellationToken = default)
```

**Node.js:**

```typescript
send(activityOrText: string | Partial<CoreActivity>): Promise<ResourceResponse | undefined>
```

**Python:**

```python
async def send(
    self,
    activity_or_text: str | CoreActivity | dict[str, Any],
) -> ResourceResponse | None
```

**Behavior**:
1. If passed a string, constructs a `message` activity with that text.
2. If passed an activity/dict, merges it with auto-populated routing fields (`from`, `recipient`, `conversation`, `serviceUrl`).
3. Calls the underlying `BotApplication.sendActivityAsync` / `SendActivityAsync` / `send_activity_async`.
4. Returns the `ResourceResponse` (with the new activity ID).

### Send Typing Indicator

Sends a typing indicator to the conversation. Ephemeral — does not return an activity ID.

**.NET:**

```csharp
Task<string> SendTypingAsync(CancellationToken cancellationToken = default)
```

**Node.js:**

```typescript
sendTyping(): Promise<void>
```

**Python:**

```python
async def send_typing(self) -> None
```

**Behavior**: Constructs a `typing` activity with routing fields from `context.activity`, then sends it.

---

## Usage Examples

### .NET

```csharp
app.On("message", async (context, ct) =>
{
    await context.SendTypingAsync(ct);
    // ... do work ...
    await context.SendAsync("Processing complete!", ct);
});
```

### Node.js

```typescript
bot.on('message', async (ctx) => {
  await ctx.sendTyping()
  // ... do work ...
  await ctx.send('Processing complete!')
})
```

### Python

```python
@bot.on("message")
async def on_message(ctx: TurnContext):
    await ctx.send_typing()
    # ... do work ...
    await ctx.send("Processing complete!")
```

---

## Lifecycle

1. `BotApplication` receives an activity via `POST /api/messages`.
2. `BotApplication` constructs a `TurnContext` from the activity.
3. The same `TurnContext` instance flows through:
   - Middleware pipeline (in registration order)
   - Handler dispatch (invoke or per-type)
4. Handlers and middleware can call `ctx.send()` / `ctx.sendTyping()` at any point.
5. After the turn completes, the `TurnContext` is discarded.

**State sharing**: All middleware and the final handler share the same `TurnContext` instance. Middleware can attach data to the context (via extension properties or dictionaries) for downstream handlers to read.

---

## Immutability Note

The `activity` property itself is immutable (do not replace the reference). However, in weakly-typed languages (Node.js, Python), middleware CAN mutate fields on the activity object (e.g., `context.activity.text = "modified"`). Changes persist through the pipeline. See [Protocol — Middleware](./protocol.md#middleware) for details.

---

## Language-Specific Notes

| Aspect | .NET | Node.js | Python |
|--------|------|---------|--------|
| Constructor | `new TurnContext(app, activity)` (internal) | Factory function `createTurnContext(app, activity)` | `TurnContext(app, activity)` |
| Send returns | `Task<string>` (activity ID) | `Promise<ResourceResponse \| undefined>` | `ResourceResponse \| None` |
| Typing indicator returns | `Task<string>` (activity ID) | `Promise<void>` | `None` |
| Async model | `async/await` + `CancellationToken` | `async/await` (Promise) | `async/await` (asyncio) |

---

## References

- [Protocol Spec](./protocol.md) — middleware and handler dispatch
- [CoreActivityBuilder Spec](./core-activity-builder.md) — activity construction
- [ConversationClient Spec](./conversation-client.md) — low-level API for sending activities
