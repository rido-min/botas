---
outline: deep
---

# State Management

TurnState lets you persist data across turns within conversations, individual users, and single turns. Store conversation history, user preferences, or transient data without manually managing keys and storage. State automatically loads at the start of each turn and saves when your handler completes.

## Try the sample

A runnable counter bot in all three languages that demonstrates conversation, user, and temp scopes with FileStorage:

- **.NET**: [dotnet/samples/06-state-bot/](https://github.com/rido-min/botas/tree/main/dotnet/samples/06-state-bot/)
- **Node.js**: [node/samples/06-state-bot/](https://github.com/rido-min/botas/tree/main/node/samples/06-state-bot/)
- **Python**: [python/samples/06-state-bot/](https://github.com/rido-min/botas/tree/main/python/samples/06-state-bot/)

Run it locally, send a few messages, and watch the JSON files appear in `state-data/`.

## When do you need it?

Use TurnState when you want to:

- **Track conversation context** — dialog flow, turn counters, conversation history
- **Store user preferences** — settings, display names, language choices
- **Remember transient data** — per-turn scratch space for data flowing between middleware and handlers
- **Avoid manual storage** — automatic key derivation, dirty tracking, and lifecycle management

If you don't register state middleware, `context.state` is `null`/`undefined`/`None` and your bot works exactly as before — TurnState is completely opt-in.

---

## Scopes: When to use which

TurnState provides three scopes, each with a different lifetime and persistence model:

| Scope | Lifetime | Persists? | Use case |
|-------|----------|-----------|----------|
| **Conversation** | Entire conversation (all turns, all participants) | ✅ Yes | Dialog history, turn counter, shared conversation state |
| **User** | Across all conversations with this user | ✅ Yes | User preferences, display name, settings |
| **Temp** | Current turn only | ❌ No | Scratch space for this turn; pass data between middleware layers |

### Conversation scope

Use `state.conversation` to store data that's shared across all participants and all turns within a single conversation (group chat, 1:1 channel, etc.).

**Example: Conversation turn counter**

::: code-group
```csharp [.NET]
app.On("message", async (ctx, ct) =>
{
    var count = ctx.State?.Conversation.Get<int>("turnCount") ?? 0;
    count++;
    ctx.State?.Conversation.Set("turnCount", count);
    await ctx.SendAsync($"Turn #{count}", ct);
});
```

```typescript [Node.js]
bot.on('message', async (ctx) => {
  const count = (ctx.state?.conversation.get<number>('turnCount') ?? 0) + 1
  ctx.state?.conversation.set('turnCount', count)
  await ctx.send(`Turn #${count}`)
})
```

```python [Python]
@bot.on("message")
async def on_message(ctx):
    count = (ctx.state.conversation.get("turnCount", int) or 0) + 1 if ctx.state else 0
    if ctx.state:
        ctx.state.conversation.set("turnCount", count)
    await ctx.send(f"Turn #{count}")
```
:::

### User scope

Use `state.user` to store data that follows a user across all conversations (persists per user globally, not per conversation).

**Example: User preferences**

::: code-group
```csharp [.NET]
app.On("message", async (ctx, ct) =>
{
    var name = ctx.State?.User.Get<string>("displayName");
    if (name is null)
    {
        name = ctx.Activity.From?.Name ?? "User";
        ctx.State?.User.Set("displayName", name);
    }
    await ctx.SendAsync($"Hello, {name}!", ct);
});
```

```typescript [Node.js]
bot.on('message', async (ctx) => {
  let name = ctx.state?.user.get<string>('displayName')
  if (!name) {
    name = ctx.activity.from?.name ?? 'User'
    ctx.state?.user.set('displayName', name)
  }
  await ctx.send(`Hello, ${name}!`)
})
```

```python [Python]
@bot.on("message")
async def on_message(ctx):
    name = ctx.state.user.get("displayName", str) if ctx.state else None
    if not name:
        name = (ctx.activity.from_.name if ctx.activity.from_ else None) or "User"
        if ctx.state:
            ctx.state.user.set("displayName", name)
    await ctx.send(f"Hello, {name}!")
```
:::

### Temp scope

Use `state.temp` for ephemeral, per-turn data. **Temp is never persisted** — it's discarded at the end of the turn. Useful for passing intermediate data between middleware layers or storing transient computations.

**Example: Temp data between middleware and handler**

::: code-group
```csharp [.NET]
// Middleware stores something in temp
app.Use(async (ctx, next) =>
{
    ctx.State?.Temp.Set("requestId", Guid.NewGuid().ToString());
    await next(ctx);
});

// Handler retrieves it
app.On("message", async (ctx, ct) =>
{
    var requestId = ctx.State?.Temp.Get<string>("requestId") ?? "unknown";
    await ctx.SendAsync($"Request: {requestId}", ct);
});
```

```typescript [Node.js]
// Middleware stores something in temp
bot.use(async (ctx, next) => {
  ctx.state?.temp.set('requestId', crypto.randomUUID())
  await next()
})

// Handler retrieves it
bot.on('message', async (ctx) => {
  const requestId = ctx.state?.temp.get<string>('requestId') ?? 'unknown'
  await ctx.send(`Request: ${requestId}`)
})
```

```python [Python]
import uuid

# Middleware stores something in temp
@bot.use()
async def store_request_id(ctx, next):
    if ctx.state:
        ctx.state.temp.set("requestId", str(uuid.uuid4()))
    await next()

# Handler retrieves it
@bot.on("message")
async def on_message(ctx):
    request_id = ctx.state.temp.get("requestId", str) if ctx.state else "unknown"
    await ctx.send(f"Request: {request_id}")
```
:::

---

## Quick Start

### 1. Create a storage adapter

Choose one:

**MemoryStorage** — In-process dictionary. Good for development and testing. Does not persist across bot restarts.

::: code-group
```csharp [.NET]
var storage = new MemoryStorage();
```

```typescript [Node.js]
const storage = new MemoryStorage()
```

```python [Python]
storage = MemoryStorage()
```
:::

**FileStorage** — Persists state to JSON files on disk. Good for simple, single-instance development deployments. **⚠️ Not thread-safe or multi-instance safe — do not use in production or horizontally scaled deployments.**

::: code-group
```csharp [.NET]
// Default directory: "./bot-state"
var storage = new FileStorage();

// Or custom directory:
var storage = new FileStorage("./data/bot-state");
```

```typescript [Node.js]
// Default directory: './bot-state'
const storage = new FileStorage()

// Or custom directory:
const storage = new FileStorage('./data/bot-state')
```

```python [Python]
# Default directory: './bot-state'
storage = FileStorage()

# Or custom directory:
storage = FileStorage('./data/bot-state')
```
:::

### 2. Register the state middleware

Call the registration method on your `BotApplication`:

::: code-group
```csharp [.NET]
var app = BotApp.Create(args);
app.UseState(new MemoryStorage());  // Register state middleware

app.On("message", async (ctx, ct) =>
{
    // ctx.State is now available
    await ctx.SendAsync("Hello!", ct);
});

app.Run();
```

```typescript [Node.js]
import { BotApplication } from 'botas-core'

const bot = new BotApplication()
bot.useState(new MemoryStorage())  // Register state middleware

bot.on('message', async (ctx) => {
  // ctx.state is now available
  await ctx.send('Hello!')
})

bot.start()
```

```python [Python]
from botas_fastapi import BotApp

bot = BotApp()
bot.use_state(MemoryStorage())  # Register state middleware

@bot.on("message")
async def on_message(ctx):
    # ctx.state is now available
    await ctx.send("Hello!")

bot.start()
```
:::

### 3. Read and write state

Inside your handler or middleware, use the three scopes:

::: code-group
```csharp [.NET]
app.On("message", async (ctx, ct) =>
{
    // Read from conversation scope
    var count = ctx.State?.Conversation.Get<int>("count") ?? 0;
    
    // Write to conversation scope
    ctx.State?.Conversation.Set("count", count + 1);
    
    // Read from user scope
    var name = ctx.State?.User.Get<string>("name");
    
    // Use temp for transient data
    ctx.State?.Temp.Set("processed", true);
    
    await ctx.SendAsync("State saved!", ct);
});
```

```typescript [Node.js]
bot.on('message', async (ctx) => {
  // Read from conversation scope
  const count = ctx.state?.conversation.get<number>('count') ?? 0
  
  // Write to conversation scope
  ctx.state?.conversation.set('count', count + 1)
  
  // Read from user scope
  const name = ctx.state?.user.get<string>('name')
  
  // Use temp for transient data
  ctx.state?.temp.set('processed', true)
  
  await ctx.send('State saved!')
})
```

```python [Python]
@bot.on("message")
async def on_message(ctx):
    if ctx.state:
        # Read from conversation scope
        count = ctx.state.conversation.get("count", int) or 0
        
        # Write to conversation scope
        ctx.state.conversation.set("count", count + 1)
        
        # Read from user scope
        name = ctx.state.user.get("name", str)
        
        # Use temp for transient data
        ctx.state.temp.set("processed", True)
    
    await ctx.send("State saved!")
```
:::

---

## Common Patterns

### Counter

Track a simple numeric value across turns:

::: code-group
```csharp [.NET]
app.On("message", async (ctx, ct) =>
{
    var counter = ctx.State?.Conversation.Get<int>("counter") ?? 0;
    counter++;
    ctx.State?.Conversation.Set("counter", counter);
    await ctx.SendAsync($"Count: {counter}", ct);
});
```

```typescript [Node.js]
bot.on('message', async (ctx) => {
  const counter = (ctx.state?.conversation.get<number>('counter') ?? 0) + 1
  ctx.state?.conversation.set('counter', counter)
  await ctx.send(`Count: ${counter}`)
})
```

```python [Python]
@bot.on("message")
async def on_message(ctx):
    if ctx.state:
        counter = (ctx.state.conversation.get("counter", int) or 0) + 1
        ctx.state.conversation.set("counter", counter)
        await ctx.send(f"Count: {counter}")
```
:::

### Last Message Timestamp

Store when the last message arrived:

::: code-group
```csharp [.NET]
app.On("message", async (ctx, ct) =>
{
    var timestamp = DateTime.UtcNow.ToString("O");
    ctx.State?.Conversation.Set("lastMessageTime", timestamp);
    await ctx.SendAsync($"Logged at {timestamp}", ct);
});
```

```typescript [Node.js]
bot.on('message', async (ctx) => {
  const timestamp = new Date().toISOString()
  ctx.state?.conversation.set('lastMessageTime', timestamp)
  await ctx.send(`Logged at ${timestamp}`)
})
```

```python [Python]
from datetime import datetime, timezone

@bot.on("message")
async def on_message(ctx):
    timestamp = datetime.now(timezone.utc).isoformat()
    if ctx.state:
        ctx.state.conversation.set("lastMessageTime", timestamp)
    await ctx.send(f"Logged at {timestamp}")
```
:::

### User Preferences

Store user-scoped settings:

::: code-group
```csharp [.NET]
app.On("message", async (ctx, ct) =>
{
    var prefs = ctx.State?.User.Get<Dictionary<string, object>>("preferences") 
        ?? new Dictionary<string, object>();
    
    prefs["language"] = "en";
    prefs["timezone"] = "UTC";
    
    ctx.State?.User.Set("preferences", prefs);
    await ctx.SendAsync("Preferences saved!", ct);
});
```

```typescript [Node.js]
bot.on('message', async (ctx) => {
  const prefs = ctx.state?.user.get<Record<string, unknown>>('preferences') ?? {}
  prefs.language = 'en'
  prefs.timezone = 'UTC'
  ctx.state?.user.set('preferences', prefs)
  await ctx.send('Preferences saved!')
})
```

```python [Python]
@bot.on("message")
async def on_message(ctx):
    if ctx.state:
        prefs = ctx.state.user.get("preferences", dict) or {}
        prefs["language"] = "en"
        prefs["timezone"] = "UTC"
        ctx.state.user.set("preferences", prefs)
        await ctx.send("Preferences saved!")
```
:::

---

## Atomic Semantics

State is **saved only when your handler completes successfully**. If your handler throws an exception, **state mutations are discarded** — no changes write to storage.

**Why?** This ensures consistency: failed turns don't leave your state in a partially-updated, potentially invalid condition.

::: code-group
```csharp [.NET]
app.On("message", async (ctx, ct) =>
{
    // Modify state
    ctx.State?.Conversation.Set("count", 42);
    
    // If an error happens here, the state change is discarded
    if (ctx.Activity.Text == "crash")
    {
        throw new InvalidOperationException("Simulated error");
    }
    
    // Handler completes successfully → state saves
    await ctx.SendAsync("OK", ct);
});
```

```typescript [Node.js]
bot.on('message', async (ctx) => {
  // Modify state
  ctx.state?.conversation.set('count', 42)
  
  // If an error happens here, the state change is discarded
  if (ctx.activity.text === 'crash') {
    throw new Error('Simulated error')
  }
  
  // Handler completes successfully → state saves
  await ctx.send('OK')
})
```

```python [Python]
@bot.on("message")
async def on_message(ctx):
    # Modify state
    if ctx.state:
        ctx.state.conversation.set("count", 42)
    
    # If an error happens here, the state change is discarded
    if ctx.activity.text == "crash":
        raise Exception("Simulated error")
    
    # Handler completes successfully → state saves
    await ctx.send("OK")
```
:::

---

## Storage Adapters

### MemoryStorage

In-process dictionary. Useful for development, testing, and stateless deployments where persistence is not needed.

- **Thread-safe**: Yes (with internal locking)
- **Persistence**: None (lost on bot restart)
- **Use case**: Development, testing, stateless hosted bots
- **Limitations**: All state lost on restart; not suitable for production scenarios

### FileStorage

Persists state to JSON files on disk. Useful for simple, single-instance development deployments or bots running in environments without cloud storage.

- **Thread-safe**: No (single-instance only)
- **Persistence**: JSON files on disk
- **Use case**: Development, simple single-instance deployments
- **Limitations**: 
  - ⚠️ **Not safe for concurrent access** — do not use in multi-process or horizontally scaled deployments
  - ⚠️ **Single-instance only** — if you run two bot instances pointing to the same FileStorage directory, one will overwrite the other's state
  - No built-in cleanup; old state files accumulate

### Cloud Storage (Coming in Future Versions)

Future versions will include cloud-native adapters:

- **BlobStorage** — Azure Blob Storage
- **CosmosDbStorage** — Azure Cosmos DB
- **RedisStorage** — Redis cache

These will support multi-instance deployments, horizontal scaling, and better performance.

---

## What TurnState is NOT

- **Not a database** — TurnState is optimized for simple key-value storage per conversation/user. For complex queries, use a dedicated database.
- **Not for large blobs** — TurnState serializes to JSON. Store small objects (a few KB each). For large files, use Blob Storage or a file service.
- **Not for cross-turn locking** — TurnState uses last-write-wins concurrency in v1. Don't rely on it for distributed locking or coordination.
- **Not a session store** — TurnState is bot-specific. For web session management, use session middleware provided by your framework (ASP.NET Core, Express, FastAPI, etc.).

---

## Limitations in v1

- **No concurrency control** — If two turns write to the same state key simultaneously, last-write-wins (no detection of conflicts).
- **Storage adapters** — Only MemoryStorage and FileStorage ship in v1. Cloud adapters (BlobStorage, Redis, Cosmos) are deferred.
- **FileStorage is single-instance only** — Do not use in multi-process or scaled deployments.
- **No encryption** — State values are serialized as plain JSON. For sensitive data, encrypt before storing.
- **No expiration** — State persists indefinitely. Implement manual cleanup if needed.

---

## Path Syntax (Advanced)

Instead of using scopes directly, you can use a path string:

| Path | Equivalent to |
|------|---|
| `"conversation.count"` | `state.conversation.get("count")` |
| `"user.name"` | `state.user.get("name")` |
| `"temp.requestId"` | `state.temp.get("requestId")` |
| `"foo"` | `state.temp.get("foo")` (defaults to temp) |

::: code-group
```csharp [.NET]
// Scope method
ctx.State?.Conversation.Set("count", 5);

// Path method (equivalent)
ctx.State?.SetValue("conversation.count", 5);

// Path without scope (defaults to temp)
ctx.State?.SetValue("foo", "bar");  // Same as: state.Temp.Set("foo", "bar")
```

```typescript [Node.js]
// Scope method
ctx.state?.conversation.set('count', 5)

// Path method (equivalent)
ctx.state?.setValue('conversation.count', 5)

// Path without scope (defaults to temp)
ctx.state?.setValue('foo', 'bar')  // Same as: state.temp.set('foo', 'bar')
```

```python [Python]
# Scope method
ctx.state.conversation.set("count", 5)

# Path method (equivalent)
ctx.state.set_value("conversation.count", 5)

# Path without scope (defaults to temp)
ctx.state.set_value("foo", "bar")  # Same as: state.temp.set("foo", "bar")
```
:::

---

## See Also

- [Middleware Guide](./middleware.md) — Extend the turn pipeline
- [Technical Spec](https://github.com/rido-min/botas/blob/main/specs/turn-state.md) — Complete architectural details
- [Architecture](https://github.com/rido-min/botas/blob/main/specs/architecture.md) — How TurnState fits into the full turn pipeline
