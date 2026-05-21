# Turn State Spec

**Purpose**: Define a mechanism for bots to persist state across turns within conversations, users, and individual turns.
**Status**: Proposed

---

## Overview

Bots often need to remember information across turns — conversation history, user preferences, or transient data for the current turn. TurnState provides scoped key-value storage that loads automatically at the start of a turn and saves at the end.

**Reference**: Inspired by [Microsoft.TeamsAI State](https://github.com/microsoft/teams-sdk/tree/release/v1/dotnet/packages/Microsoft.TeamsAI/Microsoft.TeamsAI/State), simplified for `botas` v1.

---

## Motivation

The Bot Service protocol is stateless — each `POST /api/messages` is independent. Without state support, developers must:

1. Manually derive storage keys from activity fields
2. Implement load/save logic around handlers
3. Handle concurrency and dirty tracking

TurnState solves these by providing:

- **Scoped state** — Conversation, User, and Temp scopes with automatic key derivation
- **Lifecycle integration** — Load before middleware, save after handlers
- **Storage abstraction** — Pluggable backends (memory, Redis, Cosmos, etc.)
- **Dirty tracking** — Only persist changed scopes

---

## Scope Model

TurnState provides three built-in scopes:

| Scope | Lifetime | Key derivation | Persisted |
|-------|----------|----------------|-----------|
| **Conversation** | Entire conversation | `{channelId}/{botId}/conversations/{conversationId}` | Yes |
| **User** | Across all conversations with this user | `{channelId}/{botId}/users/{userId}` | Yes |
| **Temp** | Current turn only | N/A (no storage key) | No |

### Key Derivation

Keys are derived from incoming activity fields:

```
channelId     = activity.channelId
botId         = activity.recipient.id
conversationId = activity.conversation.id
userId        = activity.from.id
```

**Invariant**: Key derivation MUST use identical field extraction in all three languages.

### Scope Descriptions

**Conversation scope** (`state.conversation`):
- Persists data for the current conversation (e.g., dialog history, turn count)
- Shared across all users in a group conversation
- Key: `{channelId}/{botId}/conversations/{conversationId}`

**User scope** (`state.user`):
- Persists data for the current user across all conversations
- Useful for user preferences, profile data
- Key: `{channelId}/{botId}/users/{userId}`

**Temp scope** (`state.temp`):
- Ephemeral storage for the current turn only
- Never persisted to storage
- Useful for passing data between middleware and handlers without polluting other scopes

---

## Storage Abstraction

### IStorage Interface

All three languages implement a common storage interface:

**.NET:**

```csharp
/// <summary>
/// Storage provider for reading/writing bot state.
/// </summary>
public interface IStorage
{
    /// <summary>
    /// Read items from storage.
    /// </summary>
    /// <param name="keys">Keys to read.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Dictionary of key-value pairs that exist in storage.</returns>
    Task<IDictionary<string, object>> ReadAsync(
        string[] keys,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Write items to storage.
    /// </summary>
    /// <param name="changes">Dictionary of key-value pairs to write.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task WriteAsync(
        IDictionary<string, object> changes,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Delete items from storage.
    /// </summary>
    /// <param name="keys">Keys to delete.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task DeleteAsync(
        string[] keys,
        CancellationToken cancellationToken = default);
}
```

**Node.js:**

```typescript
/**
 * Storage provider for reading/writing bot state.
 */
export interface Storage {
  /**
   * Read items from storage.
   * @param keys - Keys to read.
   * @returns Dictionary of key-value pairs that exist in storage.
   */
  read(keys: string[]): Promise<Record<string, unknown>>

  /**
   * Write items to storage.
   * @param changes - Dictionary of key-value pairs to write.
   */
  write(changes: Record<string, unknown>): Promise<void>

  /**
   * Delete items from storage.
   * @param keys - Keys to delete.
   */
  delete(keys: string[]): Promise<void>
}
```

**Python:**

```python
from typing import Protocol

class Storage(Protocol):
    """Storage provider for reading/writing bot state."""

    async def read(self, keys: list[str]) -> dict[str, object]:
        """Read items from storage.
        
        Args:
            keys: Keys to read.
            
        Returns:
            Dictionary of key-value pairs that exist in storage.
        """
        ...

    async def write(self, changes: dict[str, object]) -> None:
        """Write items to storage.
        
        Args:
            changes: Dictionary of key-value pairs to write.
        """
        ...

    async def delete(self, keys: list[str]) -> None:
        """Delete items from storage.
        
        Args:
            keys: Keys to delete.
        """
        ...
```

### Built-in Implementations

**v1 ships with:**

| Implementation | Description | Thread-safe |
|----------------|-------------|-------------|
| `MemoryStorage` | In-process dictionary | Yes (with locking) |

**Deferred to future versions:**

| Implementation | Description |
|----------------|-------------|
| `BlobStorage` | Azure Blob Storage |
| `CosmosDbStorage` | Azure Cosmos DB |
| `RedisStorage` | Redis cache |

---

## TurnState API

### TurnState Class

**.NET:**

```csharp
/// <summary>
/// State container for a single turn, providing scoped access to
/// conversation, user, and temporary state.
/// </summary>
public class TurnState
{
    /// <summary>
    /// Conversation-scoped state (persisted per conversation).
    /// </summary>
    public StateScope Conversation { get; }

    /// <summary>
    /// User-scoped state (persisted per user across conversations).
    /// </summary>
    public StateScope User { get; }

    /// <summary>
    /// Temporary state for the current turn (not persisted).
    /// </summary>
    public StateScope Temp { get; }

    /// <summary>
    /// Get a value by path. Path format: "[scope].property" or "property" (defaults to temp).
    /// </summary>
    public T? GetValue<T>(string path);

    /// <summary>
    /// Set a value by path. Path format: "[scope].property" or "property" (defaults to temp).
    /// </summary>
    public void SetValue<T>(string path, T value);

    /// <summary>
    /// Check if a value exists at path.
    /// </summary>
    public bool HasValue(string path);

    /// <summary>
    /// Delete a value at path.
    /// </summary>
    public void DeleteValue(string path);

    /// <summary>
    /// Delete all state in the conversation scope.
    /// </summary>
    public void DeleteConversationState();

    /// <summary>
    /// Delete all state in the user scope.
    /// </summary>
    public void DeleteUserState();

    /// <summary>
    /// Delete all state in the temp scope.
    /// </summary>
    public void DeleteTempState();
}
```

**Node.js:**

```typescript
/**
 * State container for a single turn, providing scoped access to
 * conversation, user, and temporary state.
 */
export interface TurnState {
  /** Conversation-scoped state (persisted per conversation). */
  readonly conversation: StateScope

  /** User-scoped state (persisted per user across conversations). */
  readonly user: StateScope

  /** Temporary state for the current turn (not persisted). */
  readonly temp: StateScope

  /**
   * Get a value by path. Path format: "[scope].property" or "property" (defaults to temp).
   */
  getValue<T = unknown>(path: string): T | undefined

  /**
   * Set a value by path. Path format: "[scope].property" or "property" (defaults to temp).
   */
  setValue<T>(path: string, value: T): void

  /**
   * Check if a value exists at path.
   */
  hasValue(path: string): boolean

  /**
   * Delete a value at path.
   */
  deleteValue(path: string): void

  /** Delete all state in the conversation scope. */
  deleteConversationState(): void

  /** Delete all state in the user scope. */
  deleteUserState(): void

  /** Delete all state in the temp scope. */
  deleteTempState(): void
}
```

**Python:**

```python
class TurnState:
    """State container for a single turn, providing scoped access to
    conversation, user, and temporary state.
    """

    @property
    def conversation(self) -> StateScope:
        """Conversation-scoped state (persisted per conversation)."""
        ...

    @property
    def user(self) -> StateScope:
        """User-scoped state (persisted per user across conversations)."""
        ...

    @property
    def temp(self) -> StateScope:
        """Temporary state for the current turn (not persisted)."""
        ...

    def get_value(self, path: str, type_: type[T] = object) -> T | None:
        """Get a value by path. Path format: '[scope].property' or 'property' (defaults to temp)."""
        ...

    def set_value(self, path: str, value: object) -> None:
        """Set a value by path. Path format: '[scope].property' or 'property' (defaults to temp)."""
        ...

    def has_value(self, path: str) -> bool:
        """Check if a value exists at path."""
        ...

    def delete_value(self, path: str) -> None:
        """Delete a value at path."""
        ...

    def delete_conversation_state(self) -> None:
        """Delete all state in the conversation scope."""
        ...

    def delete_user_state(self) -> None:
        """Delete all state in the user scope."""
        ...

    def delete_temp_state(self) -> None:
        """Delete all state in the temp scope."""
        ...
```

### StateScope Class

Each scope is a key-value store:

**.NET:**

```csharp
public class StateScope
{
    public T? Get<T>(string key);
    public void Set<T>(string key, T value);
    public bool Has(string key);
    public void Delete(string key);
    public void Clear();
}
```

**Node.js:**

```typescript
export interface StateScope {
  get<T = unknown>(key: string): T | undefined
  set<T>(key: string, value: T): void
  has(key: string): boolean
  delete(key: string): void
  clear(): void
}
```

**Python:**

```python
class StateScope:
    def get(self, key: str, type_: type[T] = object) -> T | None: ...
    def set(self, key: str, value: object) -> None: ...
    def has(self, key: str) -> bool: ...
    def delete(self, key: str) -> None: ...
    def clear(self) -> None: ...
```

### Path Syntax

The `getValue`/`setValue`/`hasValue`/`deleteValue` methods accept a path string:

| Path | Interpretation |
|------|----------------|
| `"conversation.count"` | `state.conversation.get("count")` |
| `"user.name"` | `state.user.get("name")` |
| `"temp.input"` | `state.temp.get("input")` |
| `"foo"` | `state.temp.get("foo")` (default scope is temp) |

**Invalid paths** (more than one `.`) throw `ArgumentException` / `Error` / `ValueError`.

---

## Lifecycle in the Pipeline

TurnState integrates at two points in the turn pipeline:

```
HTTP POST /api/messages
  └─ JWT validation (reject with 401 if invalid)
       └─ TurnState load (from storage)    ← NEW
            └─ Middleware chain
                 └─ Handler dispatch
       └─ TurnState save (to storage)      ← NEW
```

### Load Phase

State is loaded **before** middleware runs:

1. Compute storage keys from activity fields
2. Call `storage.read([conversationKey, userKey])`
3. Initialize `TurnState` with loaded values (or empty objects if keys not found)
4. Initialize `Temp` scope with empty object (never loaded)

### Save Phase

State is saved **after** handler completes (including after `next()` returns in middleware):

1. Check each scope for changes (dirty tracking)
2. Collect changed scopes and deleted scopes
3. Call `storage.write(changes)` and `storage.delete(deletions)` in parallel
4. Temp scope is never saved

### Dirty Tracking

Implementations MUST track whether each scope has been modified:

1. On load, compute a hash/snapshot of each scope's value
2. On save, compare current value to snapshot
3. Only write scopes where `hasChanged == true`
4. Only delete scopes where `isDeleted == true`

**Hash method**: JSON serialization of the scope object. Compare serialized strings.

### Error Handling

| Error condition | Behavior |
|-----------------|----------|
| Storage read fails | Throw `StateLoadException` — turn is aborted, returns 500 |
| Storage write fails | Throw `StateSaveException` — logged, but turn already completed |
| Activity missing required fields | Throw `ArgumentException` — cannot compute storage keys |

**Rationale**: Load failures abort the turn because the bot may make decisions based on missing state. Save failures are logged but don't fail the response because the bot's reply has already been sent.

---

## TurnContext Integration

`TurnState` is accessed via `TurnContext`:

**.NET:**

```csharp
public class TurnContext
{
    // ... existing members ...

    /// <summary>
    /// Turn state for this turn. Null if state is not configured.
    /// </summary>
    public TurnState? State { get; }
}
```

**Node.js:**

```typescript
export interface TurnContext {
  // ... existing members ...

  /** Turn state for this turn. Undefined if state is not configured. */
  readonly state?: TurnState
}
```

**Python:**

```python
class TurnContext:
    # ... existing members ...

    @property
    def state(self) -> TurnState | None:
        """Turn state for this turn. None if state is not configured."""
        ...
```

### Configuration

State is opt-in. Configure via `BotApplicationOptions`:

**.NET:**

```csharp
var app = BotApp.Create(args);
app.UseState(new MemoryStorage());  // Enable state with in-memory storage
```

**Node.js:**

```typescript
const bot = new BotApplication({
  storage: new MemoryStorage()  // Enable state with in-memory storage
})
```

**Python:**

```python
bot = BotApplication(storage=MemoryStorage())  # Enable state with in-memory storage
```

When storage is not configured, `context.state` is `null`/`undefined`/`None`.

---

## Serialization

State values are serialized to JSON for storage:

| Aspect | Rule |
|--------|------|
| Format | JSON |
| Unknown properties | Preserved (round-trip safe) |
| Null values | Serialized as `null`, not omitted |
| Date/DateTime | ISO 8601 string |
| Binary data | Base64 encoded |

**Implementations MUST** use the same JSON serialization settings as `CoreActivity` to ensure consistency.

---

## Concurrency

### v1 Strategy: Last-Write-Wins

For v1, TurnState uses a **last-write-wins** strategy:

1. No ETags or version checking
2. Concurrent writes to the same key overwrite each other
3. No locking or transactions

**Rationale**: Simplicity for v1. Most bot conversations are single-threaded (one user, sequential turns). Multi-user scenarios (group chats) rarely have conflicting writes to the same state key.

### Future: Optimistic Concurrency

Future versions MAY add ETag-based optimistic concurrency:

1. Storage returns ETag with each read
2. Write includes expected ETag
3. Write fails if ETag mismatch (concurrent modification)
4. Bot retries with fresh state

This is **out of scope for v1**.

---

## Usage Examples

### Tracking Conversation Turn Count

**.NET:**

```csharp
app.On("message", async (context, ct) =>
{
    var count = context.State?.Conversation.Get<int>("turnCount") ?? 0;
    count++;
    context.State?.Conversation.Set("turnCount", count);
    await context.SendAsync($"Turn #{count}: {context.Activity.Text}");
});
```

**Node.js:**

```typescript
bot.on('message', async (ctx) => {
  let count = ctx.state?.conversation.get<number>('turnCount') ?? 0
  count++
  ctx.state?.conversation.set('turnCount', count)
  await ctx.send(`Turn #${count}: ${ctx.activity.text}`)
})
```

**Python:**

```python
@bot.on("message")
async def on_message(ctx: TurnContext):
    count = ctx.state.conversation.get("turnCount", int) or 0 if ctx.state else 0
    count += 1
    if ctx.state:
        ctx.state.conversation.set("turnCount", count)
    await ctx.send(f"Turn #{count}: {ctx.activity.text}")
```

### User Preferences

**.NET:**

```csharp
app.On("message", async (context, ct) =>
{
    var name = context.State?.User.Get<string>("displayName");
    if (name is null)
    {
        name = context.Activity.From?.Name ?? "User";
        context.State?.User.Set("displayName", name);
    }
    await context.SendAsync($"Hello, {name}!");
});
```

### Using Path Syntax

**.NET:**

```csharp
// All equivalent:
context.State?.SetValue("conversation.count", 5);
context.State?.Conversation.Set("count", 5);

// Default to temp scope:
context.State?.SetValue("input", "hello");  // Same as state.Temp.Set("input", "hello")
```

---

## Behavioral Invariants (Cross-Language Parity)

These MUST be identical across all three language implementations:

1. **Key derivation** — Storage keys computed identically from activity fields
2. **Load timing** — State loaded before middleware runs
3. **Save timing** — State saved after handler completes
4. **Dirty tracking** — Only changed scopes are written
5. **Path parsing** — `"scope.property"` syntax parsed identically
6. **Default scope** — Unqualified paths default to `temp`
7. **JSON serialization** — Compatible with existing `CoreActivity` settings
8. **Null storage behavior** — `context.state` is null/undefined/None when storage not configured

---

## Language-Specific Intentional Differences

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Generic typing | `Get<T>()`, `Set<T>()` | `get<T>()`, `set<T>()` | `get(key, type_)` with type hint |
| Configuration | `app.UseState(storage)` method | `storage` option in constructor | `storage` parameter in constructor |
| Null-safety | `TurnState?` nullable reference | `state?: TurnState` optional | `state: TurnState \| None` union |
| State class | `TurnState` class | `TurnState` interface + factory | `TurnState` class |
| Async naming | `ReadAsync`, `WriteAsync` | `read`, `write` | `read`, `write` (async) |

---

## Out of Scope for v1

The following are explicitly deferred to future versions:

1. **Cloud storage adapters** — BlobStorage, CosmosDbStorage, RedisStorage
2. **Optimistic concurrency** — ETag-based conflict detection
3. **Custom scopes** — User-defined scopes beyond conversation/user/temp
4. **State encryption** — At-rest encryption of state values
5. **State expiration** — TTL-based automatic cleanup
6. **MemoryFork** — Copy-on-write state isolation (from TeamsAI reference)
7. **Strongly-typed state** — Derived TurnState classes with typed properties

---

## Open Questions for Rido

1. **State middleware vs. built-in**: Should state load/save be a middleware component (`app.UseState()`) or built into `BotApplication` core? Middleware is more flexible; built-in is simpler.

2. **Storage configuration location**: Should storage be configured on `BotApplication` (as proposed) or injected via DI (.NET) / constructor (Node/Python)?

3. **Save on error**: When a handler throws, should we still attempt to save state? (TeamsAI does save on error.)

4. **Temp scope pre-population**: Should temp scope include built-in keys like `input` (activity.text) and `authTokens`? (TeamsAI does this for AI scenarios.)

5. **v1 scope**: Is MemoryStorage sufficient for v1, or do we need at least one cloud adapter (BlobStorage) immediately?

---

## References

- [Microsoft.TeamsAI State](https://github.com/microsoft/teams-sdk/tree/release/v1/dotnet/packages/Microsoft.TeamsAI/Microsoft.TeamsAI/State) — Reference implementation
- [Protocol spec](./protocol.md) — Middleware pipeline and turn lifecycle
- [Architecture](./architecture.md) — Component diagram
- [TurnContext spec](./reference/) — Context object that exposes state
