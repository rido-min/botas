# Activity Schema Spec

**Purpose**: Define the JSON payload structure for activities exchanged between bots and the Bot Framework Service.
**Status**: Draft

> **Note**: Outbound activities are typically constructed using the fluent `CoreActivityBuilder`. See the [Bot Spec — CoreActivityBuilder](./README.md#coreactivitybuilder) for the API.

---

## Overview

All communication between a bot and the Bot Framework Service uses **Activity** JSON objects. This document defines the schema and serialization rules.

---

## Serialization Rules

All implementations MUST follow these rules when reading and writing activity JSON:

| Rule | Description |
|------|-------------|
| **Property naming** | `camelCase` (e.g., `serviceUrl`, `channelId`) |
| **Null handling** | Omit properties with null/undefined values when writing |
| **Extension data** | Preserve all unknown/unrecognized properties in a dictionary or equivalent structure. These MUST survive a round-trip (deserialize → serialize) without data loss. |

---

## Activity

The core message/event model. Only the fields below are explicitly typed; everything else is preserved as extension data.

```json
{
  "type": "message",
  "id": "activity-id",
  "serviceUrl": "https://smba.trafficmanager.net/...",
  "channelId": "msteams",
  "text": "Hello bot!",
  "from": { ... },
  "recipient": { ... },
  "conversation": { ... },
  "entities": [ ... ],
  "attachments": [ ... ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Activity type (e.g., `"message"`) |
| `id` | `string` | No | Unique activity identifier (assigned by the channel) |
| `serviceUrl` | `string` | Yes | Callback URL for this conversation's channel |
| `channelId` | `string` | No | Channel identifier (e.g., `"msteams"`, `"webchat"`) |
| `text` | `string` | No | Message text content |
| `from` | [ChannelAccount](#channelaccount) | Yes | Sender information |
| `recipient` | [ChannelAccount](#channelaccount) | Yes | Recipient information |
| `conversation` | [Conversation](#conversation) | Yes | Conversation context |
| `entities` | `array` | No | Mentions, card actions, and other entities |
| `attachments` | `array` | No | File or card attachments |
| *(any other)* | *any* | No | Preserved as extension data |

---

## ChannelAccount

Represents a user or bot identity.

```json
{
  "id": "29:1abc...",
  "name": "User Name",
  "aadObjectId": "guid-here",
  "role": "user"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | No | Display name |
| `aadObjectId` | `string` | No | Azure AD object ID |
| `role` | `string` | No | `"user"` or `"bot"` |
| *(any other)* | *any* | No | Preserved as extension data |

---

## Conversation

Minimal conversation reference.

```json
{
  "id": "conversation-id"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Conversation identifier |
| *(any other)* | *any* | No | Preserved as extension data |

---

## Full Inbound Example

```json
{
  "type": "message",
  "id": "activity-id",
  "serviceUrl": "https://smba.trafficmanager.net/...",
  "channelId": "msteams",
  "from": { "id": "user-id", "name": "User Name" },
  "recipient": { "id": "bot-id", "name": "Bot Name" },
  "conversation": { "id": "conversation-id" },
  "text": "Hello bot!"
}
```

## Full Outbound Example

```json
{
  "type": "message",
  "text": "Hello user!",
  "from": { "id": "bot-id", "name": "Bot Name" },
  "recipient": { "id": "user-id", "name": "User Name" },
  "conversation": { "id": "conversation-id" }
}
```

### Outbound Response

```json
{ "id": "new-activity-id" }
```

---

## Examples

Annotated JSON examples for each activity type handled by BotAS bots. For the formal schema definition, see the sections above.

### message

The most common activity type — a text message from a user or a bot reply.

#### Inbound (User → Bot)

```json
{
  "type": "message",
  "id": "1234567890",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "serviceUrl": "https://smba.trafficmanager.net/amer/",
  "channelId": "msteams",
  "from": {
    "id": "29:1abc-user-id",
    "name": "Alice",
    "aadObjectId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
  },
  "recipient": {
    "id": "28:bot-app-id",
    "name": "MyBot"
  },
  "conversation": {
    "id": "a]concat-123;messageid=9876"
  },
  "text": "Hello bot!"
}
```

| Field | Notes |
|-------|-------|
| `serviceUrl` | The callback URL for replies to this conversation. Store it if you need proactive messaging later. |
| `from` / `recipient` | The bot is always the `recipient` on inbound activities. |
| `conversation.id` | Opaque string. May contain semicolons on some channels (e.g., Teams). |
| `text` | The user's message. May include HTML mention tags in Teams (e.g., `<at>BotName</at> hello`). |

#### Outbound (Bot → User)

```json
{
  "type": "message",
  "text": "You said: Hello bot!",
  "from": {
    "id": "28:bot-app-id",
    "name": "MyBot"
  },
  "recipient": {
    "id": "29:1abc-user-id",
    "name": "Alice"
  },
  "conversation": {
    "id": "a]concat-123;messageid=9876"
  }
}
```

> **Tip**: You don't construct outbound activities manually. Use `ctx.send("text")` or `CoreActivityBuilder.withConversationReference()` — routing fields are auto-populated.

### conversationUpdate

Sent when the membership or metadata of a conversation changes — for example, when the bot or a user is added to or removed from a conversation.

```json
{
  "type": "conversationUpdate",
  "id": "f:1234567890",
  "timestamp": "2025-01-15T10:29:00.000Z",
  "serviceUrl": "https://smba.trafficmanager.net/amer/",
  "channelId": "msteams",
  "from": {
    "id": "29:1abc-user-id",
    "name": "Alice"
  },
  "recipient": {
    "id": "28:bot-app-id",
    "name": "MyBot"
  },
  "conversation": {
    "id": "a]concat-123"
  },
  "membersAdded": [
    {
      "id": "28:bot-app-id",
      "name": "MyBot"
    }
  ],
  "membersRemoved": []
}
```

| Field | Notes |
|-------|-------|
| `membersAdded` | Array of `ChannelAccount` objects for members who joined. |
| `membersRemoved` | Array of `ChannelAccount` objects for members who left. |

> `membersAdded` and `membersRemoved` are extension data — they are not typed as top-level fields on `CoreActivity`. Access them via the extension/properties dictionary.

#### Handler examples

```csharp
// .NET
app.On("conversationUpdate", async (ctx, ct) =>
{
    Console.WriteLine("Members changed");
});
```

```typescript
// Node.js
bot.on('conversationUpdate', async (ctx) => {
  console.log('members added', ctx.activity.properties?.['membersAdded'])
})
```

```python
# Python
@bot.on("conversationUpdate")
async def on_update(ctx):
    print("members added", (ctx.activity.model_extra or {}).get("membersAdded"))
```

### messageReaction

Sent when a user adds or removes a reaction (emoji) on a message.

```json
{
  "type": "messageReaction",
  "id": "f:9876543210",
  "timestamp": "2025-01-15T10:35:00.000Z",
  "serviceUrl": "https://smba.trafficmanager.net/amer/",
  "channelId": "msteams",
  "from": {
    "id": "29:1abc-user-id",
    "name": "Alice"
  },
  "recipient": {
    "id": "28:bot-app-id",
    "name": "MyBot"
  },
  "conversation": {
    "id": "a]concat-123"
  },
  "reactionsAdded": [
    { "type": "like" }
  ],
  "reactionsRemoved": [],
  "replyToId": "1234567890"
}
```

| Field | Notes |
|-------|-------|
| `reactionsAdded` | Array of reaction objects added to the message. |
| `reactionsRemoved` | Array of reaction objects removed from the message. |
| `replyToId` | The ID of the message the reaction targets. |

> Like `conversationUpdate`, reaction arrays are extension data.

### invoke

Sent by the channel when a card action, task module, or messaging extension triggers a server-side call. The bot is expected to return a response body (not `{}`).

```json
{
  "type": "invoke",
  "name": "adaptiveCard/action",
  "id": "f:invoke-001",
  "timestamp": "2025-01-15T11:00:00.000Z",
  "serviceUrl": "https://smba.trafficmanager.net/amer/",
  "channelId": "msteams",
  "from": {
    "id": "29:1abc-user-id",
    "name": "Alice"
  },
  "recipient": {
    "id": "28:bot-app-id",
    "name": "MyBot"
  },
  "conversation": {
    "id": "a]concat-123"
  },
  "value": {
    "action": {
      "type": "Action.Execute",
      "data": {
        "choice": "option-a"
      }
    }
  }
}
```

| Field | Notes |
|-------|-------|
| `name` | The invoke action name (e.g., `adaptiveCard/action`, `task/fetch`, `composeExtension/query`). |
| `value` | Action-specific payload (card data, task module input, etc.). |

> **Important**: The BotAS `ConversationClient` silently skips outbound `invoke` activities (they are response-only on the inbound path). See [Protocol — Outbound Activity Filtering](./protocol.md#outbound-activity-filtering).

### installationUpdate

Sent when the bot is installed or uninstalled from a scope (personal, team, or group chat).

```json
{
  "type": "installationUpdate",
  "id": "f:install-001",
  "timestamp": "2025-01-15T09:00:00.000Z",
  "serviceUrl": "https://smba.trafficmanager.net/amer/",
  "channelId": "msteams",
  "from": {
    "id": "29:1abc-user-id",
    "name": "Alice"
  },
  "recipient": {
    "id": "28:bot-app-id",
    "name": "MyBot"
  },
  "conversation": {
    "id": "a]concat-123"
  },
  "action": "add"
}
```

| Field | Notes |
|-------|-------|
| `action` | `"add"` when the bot is installed, `"remove"` when uninstalled. |

> This is a good place to initialize conversation state or store the `serviceUrl` and `conversation.id` for future proactive messages.

### typing

Typing activities indicate that the bot or user is composing a reply. They are ephemeral "presence" signals, not persistent messages.

#### Inbound (User → Bot)

A typing activity from a user indicates the user is composing a message. Most bots ignore inbound typing, but it can be used for analytics or state management.

```json
{
  "type": "typing",
  "id": "f:typing-001",
  "timestamp": "2025-01-15T10:31:00.000Z",
  "serviceUrl": "https://smba.trafficmanager.net/amer/",
  "channelId": "msteams",
  "from": {
    "id": "29:1abc-user-id",
    "name": "Alice"
  },
  "recipient": {
    "id": "28:bot-app-id",
    "name": "MyBot"
  },
  "conversation": {
    "id": "a]concat-123"
  }
}
```

#### Outbound (Bot → User)

A typing activity from the bot shows a typing indicator to the user — useful for long-running operations to signal the bot is "thinking".

```json
{
  "type": "typing",
  "from": {
    "id": "28:bot-app-id",
    "name": "MyBot"
  },
  "recipient": {
    "id": "29:1abc-user-id",
    "name": "Alice"
  },
  "conversation": {
    "id": "a]concat-123"
  }
}
```

| Field | Notes |
|-------|-------|
| `text` | Should be omitted (typing activities have no text). |
| Routing fields | Automatically populated by `TurnContext.sendTyping()`. |

#### Sending Typing Indicators

Instead of manually constructing `{ type: 'typing' }`, use the convenience method on `TurnContext`:

**.NET:**
```csharp
app.On("message", async (ctx, ct) =>
{
    await ctx.SendTypingAsync(ct);  // Show typing indicator
    
    // Simulate long-running work
    await Task.Delay(2000, ct);
    
    await ctx.SendAsync("Done processing!", ct);
});
```

**Node.js:**
```typescript
bot.on('message', async (ctx) => {
  await ctx.sendTyping()  // Show typing indicator
  
  // Simulate long-running work
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  await ctx.send('Done processing!')
})
```

**Python:**
```python
@bot.on("message")
async def on_message(ctx):
    await ctx.send_typing()  # Show typing indicator
    
    # Simulate long-running work
    await asyncio.sleep(2)
    
    await ctx.send("Done processing!")
```

#### Receiving Typing Activities

To handle incoming typing activities from users, use the standard activity handler pattern with `on('typing', handler)`:

**.NET:**
```csharp
app.On("typing", async (ctx, ct) =>
{
    Console.WriteLine($"{ctx.Activity.From.Name} is typing...");
});
```

**Node.js:**
```typescript
bot.on('typing', async (ctx) => {
  console.log(`${ctx.activity.from.name} is typing...`)
})
```

**Python:**
```python
@bot.on("typing")
async def on_typing(ctx):
    print(f"{ctx.activity.from_account.name} is typing...")
```

> **Note**: There is no dedicated typing handler method. Use the standard `on()` pattern to receive typing activities, the same as any other activity type.

### Unregistered Types

BotAS silently ignores activities with types that have no registered handler. You do not need to register handlers for every type — only the ones your bot cares about.

See [Protocol — Handler Dispatch](./protocol.md#handler-dispatch) for the full dispatch rules.

### Extension Data Round-Trip

All activity types may carry additional properties beyond the typed fields. BotAS preserves these as extension data, so custom channel data round-trips safely:

```json
{
  "type": "message",
  "text": "Hello",
  "customField": "preserved",
  "channelData": {
    "tenant": { "id": "tenant-guid" }
  }
}
```

Both `customField` and `channelData` are preserved in the extension dictionary. See [Serialization Rules](#serialization-rules) for details.

---

## References

- [Protocol Spec](./protocol.md) — HTTP contract for sending/receiving activities
- [Bot Framework Activity Schema](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#activity-object)
