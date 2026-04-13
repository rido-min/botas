# Activity Payloads

**Purpose**: Annotated JSON examples for each activity type handled by BotAS bots.
**Status**: Draft

> For the formal schema definition (field types, serialization rules, extension data), see [Activity Schema](./activity-schema.md). This document provides practical, annotated examples you can use as a reference when building handlers.

---

## message

The most common activity type — a text message from a user or a bot reply.

### Inbound (User → Bot)

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

### Outbound (Bot → User)

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

> **Tip**: You don't construct outbound activities manually. Use `ctx.send("text")` or `CoreActivityBuilder.withConversationReference()` — routing fields are auto-populated. See [Turn Context](./turn-context.md).

---

## conversationUpdate

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

### Handler examples

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

---

## messageReaction

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

---

## invoke

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

---

## installationUpdate

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

---

## Unregistered Types

BotAS silently ignores activities with types that have no registered handler. You do not need to register handlers for every type — only the ones your bot cares about.

See [Protocol — Handler Dispatch](./protocol.md#handler-dispatch) for the full dispatch rules.

---

## Extension Data Round-Trip

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

Both `customField` and `channelData` are preserved in the extension dictionary. See [Activity Schema — Extension Data](./activity-schema.md#serialization-rules) for rules.

---

## References

- [Activity Schema](./activity-schema.md) — formal field definitions and serialization rules
- [Protocol](./protocol.md) — HTTP contract and handler dispatch
- [Turn Context](./turn-context.md) — simplified send via `ctx.send()`
- [Teams Activity](./teams-activity.md) — Teams-specific activity types (mentions, cards, suggested actions)
- [Bot Framework Activity Schema (Microsoft docs)](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#activity-object)
