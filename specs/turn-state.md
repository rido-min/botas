# Turn State Spec

**Purpose**: Define a mechanism for bots to persist state across turns within conversations, users, and individual turns.
**Status**: Proposed

📖 **User-facing guide**: [State Management](../../../docs-site/state.md) — quick-start examples and common patterns for developers.

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

| Implementation | Description | Thread-safe | Use case |
|----------------|-------------|-------------|----------|
| `MemoryStorage` | In-process dictionary | Yes (with locking) | Development, testing, single-instance bots |
| `FileStorage` | JSON files on disk | No (single-instance only) | Development, simple persistence for single-instance deployments |

**FileStorage details:**
- One JSON file per key (path-safe key encoding)
- Configurable root directory
- No locking in v1 — designed for single-instance deployments; concurrent access is unsafe
- `read()` returns `null`/empty for missing files
- `write()` creates parent directories if needed
- `delete()` is idempotent (no error if file doesn't exist)
- **Limitation**: Not suitable for multi-instance deployments (horizontal scaling, web farms)

**Deferred to future versions:**

| Implementation | Description |
|----------------|-------------|
| `BlobStorage` | Azure Blob Storage |
| `CosmosDbStorage` | Azure Cosmos DB |
| `RedisStorage` | Redis cache |

### MemoryStorage API

**.NET:**
```csharp
var storage = new MemoryStorage();
```

**Node.js:**
```typescript
const storage = new MemoryStorage()
```

**Python:**
```python
storage = MemoryStorage()
```

### FileStorage API

**.NET:**
```csharp
// Default directory: "./bot-state"
var storage = new FileStorage();

// Custom directory
var storage = new FileStorage("./data/state");
```

**Node.js:**
```typescript
// Default directory: './bot-state'
const storage = new FileStorage()

// Custom directory
const storage = new FileStorage('./data/state')
```

**Python:**
```python
# Default directory: './bot-state'
storage = FileStorage()

# Custom directory
storage = FileStorage('./data/state')
```

**FileStorage implementation notes:**
- Keys are sanitized for filesystem safety (e.g., `/` → `_`, special chars escaped)
- Files are stored as `{root}/{sanitized_key}.json`
- Reads return empty dict for missing files (no error)
- Writes create parent directories automatically
- Deletes are idempotent (no error if file missing)
- Thread-safety: **None** — assumes single-process, single-instance deployment

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

TurnState is implemented as **opt-in middleware** registered via `app.UseState(storage)`. When registered, state middleware:

```
HTTP POST /api/messages
  └─ JWT validation (reject with 401 if invalid)
       └─ State Middleware (if configured)    ← NEW
            ├─ Load state from storage
            ├─ Attach TurnState to context
            ├─ Call next() → inner middleware + handler
            └─ Save dirty state (ONLY if next() returns without throwing)
```

### Middleware Registration

State support is opt-in. Configure via middleware registration:

**.NET:**
```csharp
var app = BotApp.Create(args);
app.UseState(new MemoryStorage());  // Register state middleware
// or
app.UseState(new FileStorage("./bot-state"));  // FileStorage with custom directory
```

**Node.js:**
```typescript
const bot = new BotApplication()
bot.useState(new MemoryStorage())  // Register state middleware
// or
bot.useState(new FileStorage('./bot-state'))  // FileStorage with custom directory
```

**Python:**
```python
bot = BotApplication()
bot.use_state(MemoryStorage())  # Register state middleware
# or
bot.use_state(FileStorage('./bot-state'))  # FileStorage with custom directory
```

When state middleware is not registered, `context.state` is `null`/`undefined`/`None`.

### Load Phase

State is loaded **at the start of the middleware**:

1. Compute storage keys from activity fields
2. Call `storage.read([conversationKey, userKey])`
3. Initialize `TurnState` with loaded values (or empty objects if keys not found)
4. Initialize `Temp` scope with empty object (never loaded)
5. Attach `TurnState` to `context.state`
6. Call `next()` to continue the middleware chain

### Save Phase

State is saved **after `next()` returns successfully**:

1. Check each scope for changes (dirty tracking)
2. Collect changed scopes and deleted scopes
3. Call `storage.write(changes)` and `storage.delete(deletions)` in parallel
4. Temp scope is never saved

**Atomic semantics**: If `next()` throws (handler or downstream middleware error), the save phase is **skipped entirely** — no state writes go to storage. State changes are discarded. The exception still propagates per existing BotHandlerException rules.

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
| Handler/middleware throws | **Discard state changes** — save phase is skipped, exception propagates |

**Rationale for atomic semantics (discard on error)**:
- **Consistency**: State writes are "all or nothing" — a failed turn does not partially update state
- **Matches Teams SDK behavior**: `teams-sdk` (TeamsAI) uses the same default (save only on success)
- **Safety**: If a handler crashes, we don't persist potentially invalid/incomplete state mutations
- **Simplicity**: No "should I save or rollback?" logic — failed turns are discarded

Load failures abort the turn because the bot may make decisions based on missing state. Save failures are logged but don't fail the response because the bot's reply has already been sent.

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

State is opt-in. Configure via middleware registration (see "Middleware Registration" above).

**.NET:**

```csharp
var app = BotApp.Create(args);
app.UseState(new MemoryStorage());  // In-memory storage
// or
app.UseState(new FileStorage("./bot-state"));  // File-based storage
```

**Node.js:**

```typescript
const bot = new BotApplication()
bot.useState(new MemoryStorage())  // In-memory storage
// or
bot.useState(new FileStorage('./bot-state'))  // File-based storage
```

**Python:**

```python
bot = BotApplication()
bot.use_state(MemoryStorage())  # In-memory storage
# or
bot.use_state(FileStorage('./bot-state'))  # File-based storage
```

When state middleware is not registered, `context.state` is `null`/`undefined`/`None`.

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
2. **Load timing** — State loaded at the start of state middleware (before inner middleware/handlers)
3. **Save timing** — State saved after `next()` returns successfully
4. **Atomic semantics** — State changes discarded if `next()` throws (no save on error)
5. **Dirty tracking** — Only changed scopes are written
6. **Path parsing** — `"scope.property"` syntax parsed identically
7. **Default scope** — Unqualified paths default to `temp`
8. **JSON serialization** — Compatible with existing `CoreActivity` settings
9. **Null storage behavior** — `context.state` is null/undefined/None when state middleware not registered
10. **FileStorage key sanitization** — Percent-encoding (RFC 3986) must be identical across languages (see "Cross-Language Parity Rules" section)

---

## Cross-Language Parity Rules

These rules ensure file storage is portable and interoperable across language implementations.

### FileStorage Key Encoding

**Canonical algorithm**: Percent-encode the storage key using RFC 3986 with NO safe characters.

| Language | Function |
|----------|----------|
| .NET | `Uri.EscapeDataString(key)` |
| Node.js | `encodeURIComponent(key)` |
| Python | `urllib.parse.quote(key, safe="")` |

All three produce identical output for the same input.

**Examples**:

| Raw Storage Key | Encoded Filename |
|-----------------|-----------------|
| `msteams/bot-123/conversations/conv-456` | `msteams%2Fbot-123%2Fconversations%2Fconv-456.json` |
| `foo bar` | `foo%20bar.json` |
| `user@domain.com` | `user%40domain.com.json` |
| `key:with:colons` | `key%3Awith%3Acolons.json` |
| `simple-key_123` | `simple-key_123.json` (alphanumeric, `-`, `_` not encoded) |

**Rationale**: Percent-encoding is lossless (reversible), deterministic, and well-defined by RFC 3986. Alternative approaches like regex replacement (`/` → `_`) are lossy and create collision risk.

### Key Derivation Format

**Conversation scope**: `{channelId}/{botId}/conversations/{conversationId}`

**User scope**: `{channelId}/{botId}/users/{userId}`

Field extraction:
```
channelId      = activity.channelId
botId          = activity.recipient.id
conversationId = activity.conversation.id
userId         = activity.from.id
```

### Path Syntax Rules

1. Paths with one dot: `"scope.key"` where scope is `conversation`, `user`, or `temp`
2. Paths with no dot: Default to `temp` scope
3. Paths with more than one dot: Throw `ArgumentException` / `Error` / `ValueError`
4. Scope names are case-insensitive: `"Conversation.count"` and `"conversation.count"` are equivalent

---

## Language-Specific Intentional Differences

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Generic typing | `Get<T>()`, `Set<T>()` | `get<T>()`, `set<T>()` | `get(key, type_)` with type hint |
| Configuration | `app.UseState(storage)` method | `bot.useState(storage)` method | `bot.use_state(storage)` method |
| Null-safety | `TurnState?` nullable reference | `state?: TurnState` optional | `state: TurnState \| None` union |
| State class | `TurnState` class | `TurnState` interface + factory | `TurnState` class |
| Async naming | `ReadAsync`, `WriteAsync` | `read`, `write` | `read`, `write` (async) |
| Storage constructor | `new MemoryStorage()`, `new FileStorage(path)` | `new MemoryStorage()`, `new FileStorage(path)` | `MemoryStorage()`, `FileStorage(path)` |

---

## Out of Scope for v1

The following are explicitly deferred to future versions:

1. **Cloud storage adapters** — BlobStorage, CosmosDbStorage, RedisStorage (FileStorage is sufficient for v1 simple persistence needs)
2. **Optimistic concurrency** — ETag-based conflict detection
3. **Custom scopes** — User-defined scopes beyond conversation/user/temp
4. **State encryption** — At-rest encryption of state values
5. **State expiration** — TTL-based automatic cleanup
6. **MemoryFork** — Copy-on-write state isolation (from TeamsAI reference)
7. **Strongly-typed state** — Derived TurnState classes with typed properties
8. **Temp scope pre-population** — Built-in keys like `input` (activity.text) or `authTokens` (deferred to AI/prompting features)

---

## Resolved Decisions

The following design decisions have been finalized:

1. **Integration model**: **Middleware**. State is opt-in via `app.UseState(storage)` registration. NOT built into BotApplication core. Matches the existing middleware pipeline model and allows flexible composition.

2. **Save on error**: **Discard**. State changes are saved ONLY when the turn completes successfully. If a handler or middleware throws, the save phase is skipped — no state writes go to storage. Provides atomic per-turn semantics. (Matches `teams-sdk` default behavior.)

3. **v1 storage adapters**: **MemoryStorage AND FileStorage**. Both ship in v1:
   - `MemoryStorage` — In-process dictionary for development/testing
   - `FileStorage` — JSON files on disk for simple persistence in single-instance deployments
   - Cloud adapters (BlobStorage, CosmosDbStorage, RedisStorage) deferred to follow-up issues

**Deferred decisions** (out of scope for v1):
- Temp scope pre-population (`input`, `authTokens`, etc.) — deferred to future AI/prompting features
- Custom scopes beyond conversation/user/temp — not needed for v1 use cases

---

## References

- [Microsoft.TeamsAI State](https://github.com/microsoft/teams-sdk/tree/release/v1/dotnet/packages/Microsoft.TeamsAI/Microsoft.TeamsAI/State) — Reference implementation
- [Protocol spec](./protocol.md) — Middleware pipeline and turn lifecycle
- [Architecture](./architecture.md) — Component diagram
- [TurnContext spec](./reference/) — Context object that exposes state
