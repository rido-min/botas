# Proactive Messaging

**Purpose**: How to send messages outside of a turn using `ConversationClient`.
**Status**: Draft

---

## Overview

Normally, bots send replies within a turn — the user sends a message, the bot replies using `ctx.send()`. **Proactive messaging** is when the bot initiates a message outside of a user-triggered turn, such as sending a notification, a scheduled reminder, or a follow-up.

To send a proactive message, you need:

1. A **stored conversation reference** (service URL + conversation ID) from a previous turn.
2. The **`ConversationClient`** (or `BotApplication.sendActivityAsync`) to send the outbound activity.
3. A valid **outbound auth token** — handled automatically by the token manager.

---

## Storing the Conversation Reference

During a normal turn, save the `serviceUrl` and `conversation.id` from the incoming activity. You'll use these later to send proactive messages.

### .NET

```csharp
// In-memory store (use a database in production)
static readonly Dictionary<string, (string ServiceUrl, string ConversationId)> References = new();

app.On("message", async (ctx, ct) =>
{
    // Store the reference keyed by user ID
    References[ctx.Activity.From!.Id] = (ctx.Activity.ServiceUrl!, ctx.Activity.Conversation!.Id);
    await ctx.SendAsync("Got it — I'll notify you later.", ct);
});
```

### Node.js

```typescript
const references = new Map<string, { serviceUrl: string; conversationId: string }>()

bot.on('message', async (ctx) => {
  references.set(ctx.activity.from.id, {
    serviceUrl: ctx.activity.serviceUrl,
    conversationId: ctx.activity.conversation.id,
  })
  await ctx.send("Got it — I'll notify you later.")
})
```

### Python

```python
references: dict[str, dict] = {}

@bot.on("message")
async def on_message(ctx):
    references[ctx.activity.from_account.id] = {
        "service_url": ctx.activity.service_url,
        "conversation_id": ctx.activity.conversation.id,
    }
    await ctx.send("Got it — I'll notify you later.")
```

---

## Sending a Proactive Message

### Via `BotApplication.sendActivityAsync`

The simplest approach — uses the bot's built-in `ConversationClient` and token management.

#### .NET

```csharp
// BotApplication.SendActivityAsync takes a CoreActivity with routing fields embedded
var activity = new CoreActivityBuilder()
    .WithServiceUrl(reference.ServiceUrl)
    .WithConversation(reference.ConversationId)
    .WithText("🔔 Here's your proactive notification!")
    .Build();

await bot.SendActivityAsync(activity, CancellationToken.None);
```

#### Node.js

```typescript
// BotApplication.sendActivityAsync takes (serviceUrl, conversationId, activity)
await bot.sendActivityAsync(
  ref.serviceUrl,
  ref.conversationId,
  { type: 'message', text: '🔔 Here is your proactive notification!' }
)
```

#### Python

```python
# BotApplication.send_activity_async takes (service_url, conversation_id, activity)
await bot.send_activity_async(
    ref["service_url"],
    ref["conversation_id"],
    {"type": "message", "text": "🔔 Here is your proactive notification!"},
)
```

### Via `ConversationClient` Directly

For more control (e.g., creating new conversations or managing members), use the `ConversationClient` directly.

#### Node.js

```typescript
const client = bot.conversationClient

// Send to an existing conversation
await client.sendCoreActivityAsync(serviceUrl, conversationId, {
  type: 'message',
  text: 'Proactive hello!',
})

// Create a new 1:1 conversation (Teams)
const response = await client.createConversationAsync(serviceUrl, {
  bot: { id: botId },
  members: [{ id: userId }],
  isGroup: false,
  activity: { type: 'message', text: 'Starting a new conversation!' },
})
```

#### Python

```python
client = bot.conversation_client

# Send to an existing conversation
await client.send_activity_async(service_url, conversation_id, {
    "type": "message",
    "text": "Proactive hello!",
})

# Create a new 1:1 conversation
response = await client.create_conversation_async(service_url, {
    "bot": {"id": bot_id},
    "members": [{"id": user_id}],
    "isGroup": False,
    "activity": {"type": "message", "text": "Starting a new conversation!"},
})
```

---

## ConversationClient API

The `ConversationClient` wraps the [Bot Framework v3 Conversations REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#conversations-object).

| Method | Description |
|--------|-------------|
| `sendCoreActivityAsync` / `send_activity_async` | Send an activity to a conversation |
| `updateCoreActivityAsync` / `update_activity_async` | Update an existing activity |
| `deleteCoreActivityAsync` / `delete_activity_async` | Delete an activity |
| `createConversationAsync` / `create_conversation_async` | Create a new conversation (proactive 1:1 or group) |
| `getConversationMembersAsync` / `get_conversation_members_async` | List conversation members |
| `getConversationMemberAsync` / `get_conversation_member_async` | Get a single member by ID |
| `getConversationPagedMembersAsync` / `get_conversation_paged_members_async` | List members with pagination |
| `deleteConversationMemberAsync` / `delete_conversation_member_async` | Remove a member |
| `getConversationsAsync` / `get_conversations_async` | List all conversations the bot is in |
| `sendConversationHistoryAsync` / `send_conversation_history_async` | Upload a transcript |

---

## Authentication

Proactive messages use the same outbound authentication as turn-based replies. The `TokenManager` acquires and caches an OAuth2 client-credentials token automatically.

No additional configuration is needed beyond the standard `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` environment variables. See [Outbound Auth](./outbound-auth.md).

---

## Outbound Activity Filtering

The `ConversationClient` silently skips certain activity types:

| Skipped type | Reason |
|--------------|--------|
| `trace` | Diagnostic-only; not intended for the channel |
| `invoke` (.NET) | Invoke activities are inbound-only |

See [Protocol — Outbound Activity Filtering](./protocol.md#outbound-activity-filtering).

---

## Common Patterns

### Timer-based Notification

Trigger a proactive message from a background job or HTTP endpoint:

```typescript
// Node.js — Express route that triggers a proactive message
server.post('/api/notify', async (req, res) => {
  const { userId, message } = req.body
  const ref = references.get(userId)
  if (!ref) return res.status(404).json({ error: 'No conversation reference' })

  await bot.sendActivityAsync(ref.serviceUrl, ref.conversationId, {
    type: 'message',
    text: message,
  })
  res.json({ status: 'sent' })
})
```

### Store References on `installationUpdate`

Save conversation references when the bot is first installed:

```python
@bot.on("installationUpdate")
async def on_install(ctx):
    if (ctx.activity.model_extra or {}).get("action") == "add":
        references[ctx.activity.conversation.id] = {
            "service_url": ctx.activity.service_url,
            "conversation_id": ctx.activity.conversation.id,
        }
```

---

## Important Notes

- **Service URL is per-conversation** — always use the `serviceUrl` from the original activity; it may differ across conversations.
- **Conversation IDs are opaque** — don't parse or construct them; store and replay as-is.
- **Token caching is automatic** — the token manager handles acquisition and refresh.
- **Error handling** — proactive sends can fail if the conversation no longer exists or the bot was removed. Wrap sends in try/catch and handle `InvalidOperationError` or HTTP 4xx responses.

---

## References

- [Protocol — Outbound: Sending Activities](./protocol.md#outbound-sending-activities) — HTTP contract for sends
- [Outbound Auth](./outbound-auth.md) — OAuth2 token acquisition
- [Turn Context](./turn-context.md) — `ctx.send()` for in-turn replies
- [Activity Payloads](./ActivityPayloads.md) — example activity JSON
- [Bot Framework REST API — Create Conversation](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#create-conversation)
