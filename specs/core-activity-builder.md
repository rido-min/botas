# CoreActivityBuilder Spec

**Purpose**: Define the fluent builder API for constructing `CoreActivity` objects.  
**Status**: Draft

---

## Overview

`CoreActivityBuilder` is a fluent builder for constructing outbound activities. It simplifies the creation of reply activities by:
- Providing a chainable method interface
- Automatically copying routing fields from incoming activities (via `withConversationReference`)
- Swapping `from` and `recipient` when replying

Use this builder when constructing activities manually (outside of `ctx.send()` helpers).

---

## Constructor

**Signature** (language-specific):

**.NET:**

```csharp
new CoreActivityBuilder()
```

**Node.js:**

```typescript
new CoreActivityBuilder()
```

**Python:**

```python
CoreActivityBuilder()
```

All languages initialize the builder with default values:
- `type`: `"message"`
- `text`: `""` (empty string)

---

## Methods

All methods return `this` for method chaining (except `build()`).

### withConversationReference / WithConversationReference / with_conversation_reference

Copy routing fields from an incoming activity and swap `from` ↔ `recipient`.

**Signature**:

```csharp
// .NET
CoreActivityBuilder WithConversationReference(CoreActivity source)
```

```typescript
// Node.js
withConversationReference(source: CoreActivity): this
```

```python
# Python
def with_conversation_reference(self, source: CoreActivity) -> "CoreActivityBuilder"
```

**Behavior**: Sets the following fields on the outbound activity:
- `serviceUrl` ← `source.serviceUrl`
- `conversation` ← `source.conversation`
- `from` ← `source.recipient` (swap)
- `recipient` ← `source.from` (swap)

This is the most commonly used method for constructing replies.

---

### withType / WithType / with_type

Set the activity type.

**Signature**:

```csharp
// .NET
CoreActivityBuilder WithType(string type)
```

```typescript
// Node.js
withType(type: string): this
```

```python
# Python
def with_type(self, type: str) -> "CoreActivityBuilder"
```

**Default**: `"message"`

---

### withText / WithText / with_text

Set the text content of the activity.

**Signature**:

```csharp
// .NET
CoreActivityBuilder WithText(string text)
```

```typescript
// Node.js
withText(text: string): this
```

```python
# Python
def with_text(self, text: str) -> "CoreActivityBuilder"
```

---

### withServiceUrl / WithServiceUrl / with_service_url

Set the service URL for the channel.

**Signature**:

```csharp
// .NET
CoreActivityBuilder WithServiceUrl(string serviceUrl)
```

```typescript
// Node.js
withServiceUrl(serviceUrl: string): this
```

```python
# Python
def with_service_url(self, service_url: str) -> "CoreActivityBuilder"
```

---

### withConversation / WithConversation / with_conversation

Set the conversation reference.

**Signature**:

```csharp
// .NET
CoreActivityBuilder WithConversation(Conversation conversation)
```

```typescript
// Node.js
withConversation(conversation: Conversation): this
```

```python
# Python
def with_conversation(self, conversation: Conversation) -> "CoreActivityBuilder"
```

---

### withFrom / WithFrom / with_from

Set the sender account.

**Signature**:

```csharp
// .NET
CoreActivityBuilder WithFrom(ChannelAccount from)
```

```typescript
// Node.js
withFrom(from: ChannelAccount): this
```

```python
# Python
def with_from(self, from_account: ChannelAccount) -> "CoreActivityBuilder"
```

**Note**: Python uses `from_account` parameter name (reserved keyword workaround).

---

### withRecipient / WithRecipient / with_recipient

Set the recipient account.

**Signature**:

```csharp
// .NET
CoreActivityBuilder WithRecipient(ChannelAccount recipient)
```

```typescript
// Node.js
withRecipient(recipient: ChannelAccount): this
```

```python
# Python
def with_recipient(self, recipient: ChannelAccount) -> "CoreActivityBuilder"
```

---

### withEntities / WithEntities / with_entities

Set the entities array (replaces existing entities).

**Signature**:

```csharp
// .NET
CoreActivityBuilder WithEntities(JsonArray entities)
```

```typescript
// Node.js
withEntities(entities: Entity[]): this
```

```python
# Python
def with_entities(self, entities: list[Entity]) -> "CoreActivityBuilder"
```

---

### withAttachments / WithAttachments / with_attachments

Set the attachments array (replaces existing attachments).

**Signature**:

```csharp
// .NET
CoreActivityBuilder WithAttachments(JsonArray attachments)
```

```typescript
// Node.js
withAttachments(attachments: Attachment[]): this
```

```python
# Python
def with_attachments(self, attachments: list[Attachment]) -> "CoreActivityBuilder"
```

---

### build / Build

Construct the final `CoreActivity` from the builder state.

**Signature**:

```csharp
// .NET
CoreActivity Build()
```

```typescript
// Node.js
build(): Partial<CoreActivity>
```

```python
# Python
def build(self) -> CoreActivity
```

**Returns**: A new activity object with the current builder state. In Node.js, the return type is `Partial<CoreActivity>` because builder-constructed activities typically don't have all fields populated (e.g., missing `id`, `channelId`). In .NET and Python, the return type is `CoreActivity` with optional fields. Calling `build()` multiple times produces independent copies.

---

## Usage Examples

### .NET

```csharp
var reply = new CoreActivityBuilder()
    .WithConversationReference(incomingActivity)
    .WithText("Hello, user!")
    .Build();

await app.SendActivityAsync(reply, cancellationToken);
```

### Node.js

```typescript
const reply = new CoreActivityBuilder()
  .withConversationReference(incomingActivity)
  .withText('Hello, user!')
  .build()

await app.sendActivityAsync(
  incomingActivity.serviceUrl,
  incomingActivity.conversation.id,
  reply
)
```

### Python

```python
reply = (
    CoreActivityBuilder()
    .with_conversation_reference(incoming_activity)
    .with_text("Hello, user!")
    .build()
)

await app.send_activity_async(
    incoming_activity.service_url,
    incoming_activity.conversation.id,
    reply,
)
```

---

## Relationship to TurnContext

`TurnContext.send()` uses `CoreActivityBuilder` internally. When you call:

```typescript
await ctx.send("Hello!")
```

The framework does:

```typescript
const reply = new CoreActivityBuilder()
  .withConversationReference(ctx.activity)
  .withText("Hello!")
  .build()
// ... then sends it
```

**When to use the builder directly**:
- Constructing proactive messages (outside the normal turn pipeline)
- Building activities with complex attachments or entities
- When you need explicit control over routing fields

**When to use `ctx.send()`**:
- Inside handlers or middleware (simpler and automatic routing)

---

## Language-Specific Notes

| Aspect | .NET | Node.js | Python |
|--------|------|---------|--------|
| Method naming | PascalCase (`WithText`) | camelCase (`withText`) | snake_case (`with_text`) |
| Type field default | `"message"` | `"message"` | `"message"` |
| Text field default | `""` | `""` | `""` |
| Immutability | Each `build()` creates a new `CoreActivity` | Each `build()` creates a new object | Each `build()` creates a new `CoreActivity` |

---

## Design Notes

- **Fluent API**: All setter methods return `this` for chaining.
- **Immutability**: The builder is mutable (you can call methods in any order), but `build()` produces an independent copy — modifying the result does not affect the builder.
- **Deep cloning**: `withConversationReference()` SHOULD deep-clone the routing fields (`conversation`, `from`, `recipient`) from the source activity to prevent aliasing. Similarly, `build()` SHOULD return a deep clone so the caller can safely mutate the result without affecting builder state.
- **Reusability**: You can call `build()` multiple times on the same builder. Each call produces a new activity with the current builder state.

---

## References

- [Activity Schema](./activity-schema.md) — full `CoreActivity` type definition
- [TurnContext Spec](./turn-context.md) — high-level send helpers
- [Protocol Spec](./protocol.md) — HTTP contract for sending activities
