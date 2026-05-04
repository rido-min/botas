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

During a normal turn, save the `serviceUrl` and `conversation.id` from the incoming activity. All languages follow the same pattern — shown here in Node.js:

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

---

## Sending a Proactive Message

### Via `BotApplication.sendActivityAsync` / `SendActivityAsync`

The simplest approach — uses the bot's built-in `ConversationClient` and token management. **This is the only proactive-send API available in .NET.**

**Node.js / Python:**

```typescript
await bot.sendActivityAsync(
  ref.serviceUrl,
  ref.conversationId,
  { type: 'message', text: '🔔 Here is your proactive notification!' }
)
```

**.NET:** Embed routing fields on the `CoreActivity` (.NET's `SendActivityAsync` takes only the activity):

```csharp
var activity = new CoreActivityBuilder()
    .WithServiceUrl(serviceUrl)
    .WithConversation(new Conversation { Id = conversationId })
    .WithText("🔔 Here is your proactive notification!")
    .Build();

await bot.SendActivityAsync(activity, cancellationToken);
```

### Via `ConversationClient` Directly (Node.js / Python only)

For more control (e.g., creating new conversations or managing members). Node.js and Python expose `bot.conversationClient` / `bot.conversation_client` as a public property; **.NET does NOT expose its `ConversationClient` publicly** (it is a private field on `BotApplication`, resolved per-request from DI).

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

> **.NET note**: Creating new conversations and managing members are not yet implemented in the .NET `ConversationClient` — see the [ConversationClient spec — Language-Specific Notes](./conversation-client.md#language-specific-notes) for the supported method matrix.

---

## ConversationClient API

The `ConversationClient` wraps the [Bot Service v3 Conversations REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#conversations-object).

| Method | Description |
|--------|-------------|
| `sendCoreActivityAsync` / `send_activity_async` | Send an activity to a conversation (.NET equivalent: `BotApplication.SendActivityAsync(activity)`) |
| `updateCoreActivityAsync` / `update_activity_async` | Update an existing activity (Node/Python only) |
| `deleteCoreActivityAsync` / `delete_activity_async` | Delete an activity (Node/Python only) |
| `createConversationAsync` / `create_conversation_async` | Create a new conversation (proactive 1:1 or group) (Node/Python only) |
| `getConversationMembersAsync` / `get_conversation_members_async` | List conversation members (Node/Python only) |
| `getConversationMemberAsync` / `get_conversation_member_async` | Get a single member by ID (Node/Python only) |
| `getConversationPagedMembersAsync` / `get_conversation_paged_members_async` | List members with pagination (Node/Python only) |
| `deleteConversationMemberAsync` / `delete_conversation_member_async` | Remove a member (Node/Python only) |
| `getConversationsAsync` / `get_conversations_async` | List all conversations the bot is in (Node/Python only) |
| `sendConversationHistoryAsync` / `send_conversation_history_async` | Upload a transcript (Node/Python only) |

---

## Authentication

Proactive messages use the same outbound authentication as turn-based replies. The `TokenManager` acquires and caches an OAuth2 client-credentials token automatically.

No additional configuration is needed beyond the standard `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` environment variables. See [Outbound Auth](./outbound-auth.md).

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
- [README — TurnContext](./README.md#turncontext) — `ctx.send()` for in-turn replies
- [Activity Schema](./activity-schema.md) — activity JSON structure
- [Bot Service REST API — Create Conversation](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#create-conversation)
