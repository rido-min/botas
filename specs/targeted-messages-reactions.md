# Targeted Messages & Reactions

**Purpose**: Define the API surface for sending targeted (user-specific) messages and handling message reactions across all three languages.
**Status**: Draft
**Issue**: [#84](https://github.com/rido-min/botas/issues/84)

> **Reference implementation**: [microsoft/teams.net PR #338](https://github.com/microsoft/teams.net/pull/338) and [Samples.TargetedMessages](https://github.com/microsoft/teams.net/tree/main/Samples/Samples.TargetedMessages).

---

## Overview

This spec covers two related capabilities:

1. **Targeted Messages** — sending a message visible only to a specific user within a group chat, channel, or meeting (Teams-specific).
2. **Message Reactions** — handling inbound `messageReaction` activities (user adds/removes a reaction) and providing convenience APIs for registering reaction handlers.

Both features build on existing `ConversationClient` infrastructure and the `messageReaction` activity type already documented in [Activity Payloads](./ActivityPayloads.md#messagereaction).

---

## 1. Targeted Messages

### What is a Targeted Message?

A targeted message is a message sent by a bot that is **visible only to one specific user** in a group conversation. Other participants do not see it. In Teams, recipients see the label _"Only you can see this message"_.

Key characteristics:
- Only works in **group chats, channels, and meetings** — 1:1 chats are already private.
- Auto-purged from clients after **24 hours** (may be retained in secure storage per org policy).
- Recipients **cannot** react to, reply to, or forward targeted messages.
- The recipient must be a **member** of the conversation.

### HTTP Endpoints

Targeted messages use standard Bot Framework v3 conversation endpoints with a query parameter:

| Operation | Endpoint |
|-----------|----------|
| **Send** | `POST /v3/conversations/{conversationId}/activities?isTargetedActivity=true` |
| **Update** | `PUT /v3/conversations/{conversationId}/activities/{activityId}?isTargetedActivity=true` |
| **Delete** | `DELETE /v3/conversations/{conversationId}/activities/{activityId}?isTargetedActivity=true` |

The activity payload is a standard [Activity](./activity-schema.md) with `recipient` set to the target user's account. All message content types are supported (text, Adaptive Cards, images, files).

### Activity Payload — Send Targeted Message

```json
{
  "type": "message",
  "text": "This message is only visible to you!",
  "recipient": {
    "id": "29:1abc-user-id",
    "name": "Alice"
  }
}
```

The `recipient` field identifies the user who will see the message. The `?isTargetedActivity=true` query parameter tells the service to deliver it as targeted.

### ConversationClient API Surface

New methods on `ConversationClient` for targeted message operations:

| Method | Description |
|--------|-------------|
| `sendTargetedActivity` | Send a targeted activity to a specific user in a conversation |
| `updateTargetedActivity` | Update an existing targeted message |
| `deleteTargetedActivity` | Delete a targeted message |

#### Cross-Language API

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Send targeted | `SendTargetedActivityAsync(serviceUrl, conversationId, activity)` → `Task<ResourceResponse>` | `sendTargetedActivityAsync(serviceUrl, conversationId, activity)` → `Promise<ResourceResponse>` | `send_targeted_activity(service_url, conversation_id, activity)` → `ResourceResponse` |
| Update targeted | `UpdateTargetedActivityAsync(serviceUrl, conversationId, activityId, activity)` → `Task<ResourceResponse>` | `updateTargetedActivityAsync(serviceUrl, conversationId, activityId, activity)` → `Promise<ResourceResponse>` | `update_targeted_activity(service_url, conversation_id, activity_id, activity)` → `ResourceResponse` |
| Delete targeted | `DeleteTargetedActivityAsync(serviceUrl, conversationId, activityId)` → `Task` | `deleteTargetedActivityAsync(serviceUrl, conversationId, activityId)` → `Promise<void>` | `delete_targeted_activity(service_url, conversation_id, activity_id)` → `None` |

> These methods are thin wrappers over the existing send/update/delete methods, appending `?isTargetedActivity=true` to the endpoint URL.

### TurnContext Convenience API

For reactive scenarios (replying to a user's message), `TurnContext` gets a convenience method:

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Send targeted reply | `ctx.SendTargetedAsync(text, recipient?, ct)` → `Task<string>` | `ctx.sendTargeted(text, recipient?)` → `Promise<void>` | `await ctx.send_targeted(text, recipient?)` → `None` |

- If `recipient` is omitted, defaults to `ctx.activity.from` (the user who sent the inbound message).
- Internally calls `ConversationClient.sendTargetedActivity` with `?isTargetedActivity=true`.
- Constructs the activity using `CoreActivityBuilder.withConversationReference()` (same pattern as `send()` and `sendTyping()`).

### Error Handling

| Status | Error Code | Meaning |
|--------|------------|---------|
| 400 | `Bad argument` | Missing recipient on send, or recipient passed on update/delete |
| 403 | `BotNotInConversationRoster` | Bot is not a member of the conversation |
| 404 | `ActivityNotFoundInConversation` | Message was deleted or expired (24h TTL) |

Fallback recommendation: if targeted send fails, consider sending a 1:1 message instead.

---

## 2. Reply to Activity

A prerequisite for reaction handling is the ability to reply to a **specific** activity (not just the conversation). This endpoint is already part of Bot Framework v3 but not yet in `ConversationClient`.

### HTTP Endpoint

```
POST /v3/conversations/{conversationId}/activities/{activityId}
```

Sends an activity as a reply to a specific message, creating a threaded reply in channels that support it.

### ConversationClient API Surface

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Reply to activity | `ReplyToActivityAsync(serviceUrl, conversationId, activityId, activity)` → `Task<ResourceResponse>` | `replyToActivityAsync(serviceUrl, conversationId, activityId, activity)` → `Promise<ResourceResponse>` | `reply_to_activity(service_url, conversation_id, activity_id, activity)` → `ResourceResponse` |

---

## 3. Message Reactions

### Inbound: Receiving Reactions

The `messageReaction` activity type is already documented in [Activity Payloads](./ActivityPayloads.md#messagereaction). When a user adds or removes a reaction (e.g., 👍, ❤️, 😄) to a message, the bot receives:

```json
{
  "type": "messageReaction",
  "reactionsAdded": [{ "type": "like" }],
  "reactionsRemoved": [],
  "replyToId": "1234567890",
  "from": { "id": "29:1abc-user-id", "name": "Alice" },
  "recipient": { "id": "28:bot-app-id", "name": "MyBot" },
  "conversation": { "id": "a]concat-123" }
}
```

#### Known Reaction Types (Teams)

| Type | Emoji |
|------|-------|
| `like` | 👍 |
| `heart` | ❤️ |
| `laugh` | 😄 |
| `surprised` | 😮 |
| `sad` | 😢 |
| `angry` | 😡 |

> Channels may support additional reaction types. Implementations MUST NOT reject unknown reaction types.

### Handler Registration

Bots can already handle `messageReaction` using the generic `on("messageReaction", handler)` pattern. This spec adds **convenience handlers** for reactions-added and reactions-removed:

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Any reaction event | `app.On("messageReaction", handler)` | `app.on('messageReaction', handler)` | `@app.on("messageReaction")` |
| Reactions added | `app.OnReactionsAdded(handler)` | `app.onReactionsAdded(handler)` | `@app.on_reactions_added()` |
| Reactions removed | `app.OnReactionsRemoved(handler)` | `app.onReactionsRemoved(handler)` | `@app.on_reactions_removed()` |

#### Handler Signatures

```
// .NET
app.OnReactionsAdded(async (TurnContext ctx, MessageReaction[] reactions, CancellationToken ct) => { ... });
app.OnReactionsRemoved(async (TurnContext ctx, MessageReaction[] reactions, CancellationToken ct) => { ... });

// Node.js
app.onReactionsAdded(async (ctx: TurnContext, reactions: MessageReaction[]) => { ... });
app.onReactionsRemoved(async (ctx: TurnContext, reactions: MessageReaction[]) => { ... });

// Python
@app.on_reactions_added()
async def handle_reactions_added(ctx: TurnContext, reactions: list[MessageReaction]) -> None: ...

@app.on_reactions_removed()
async def handle_reactions_removed(ctx: TurnContext, reactions: list[MessageReaction]) -> None: ...
```

#### Dispatch Behavior

When a `messageReaction` activity arrives:

1. If `reactionsAdded` is non-empty and `OnReactionsAdded` is registered → invoke it.
2. If `reactionsRemoved` is non-empty and `OnReactionsRemoved` is registered → invoke it.
3. If neither specialized handler is registered, fall through to generic `on("messageReaction")` handler.
4. If no handler is registered at all → silently ignore (per existing protocol spec).
5. CatchAll handler, if set, still takes precedence over all of the above.

### MessageReaction Type

```ts
// Node.js / TypeScript
interface MessageReaction {
  type: string  // e.g., "like", "heart", "laugh"
}
```

```csharp
// .NET
public class MessageReaction
{
    public string Type { get; set; }
}
```

```python
# Python
@dataclass
class MessageReaction:
    type: str
```

This type already exists in the `reactionsAdded`/`reactionsRemoved` arrays in the activity schema. Implementations should provide a strongly-typed class rather than raw dictionaries.

---

## 4. Activity Schema Additions

The following properties need to be available on `CoreActivity` (or extension data) for these features:

| Property | Type | Used by |
|----------|------|---------|
| `reactionsAdded` | `MessageReaction[]` | messageReaction activities |
| `reactionsRemoved` | `MessageReaction[]` | messageReaction activities |
| `replyToId` | `string` | messageReaction (identifies reacted-to message), reply-to-activity |

> `reactionsAdded` and `reactionsRemoved` are already accessible as extension data. Implementations SHOULD promote them to typed properties on the activity or provide typed accessors.

---

## 5. Implementation Phases

### Phase 1: ConversationClient + Reply-to-Activity
- Add `replyToActivityAsync` to `ConversationClient` (all three languages).
- Add targeted message methods (`sendTargetedActivity`, `updateTargetedActivity`, `deleteTargetedActivity`) to `ConversationClient`.
- Add `sendTargeted()` convenience to `TurnContext`.

### Phase 2: Reaction Handlers
- Add `MessageReaction` type (all three languages).
- Add `onReactionsAdded` / `onReactionsRemoved` convenience handlers to `BotApplication`.
- Dispatch logic: specialized handlers for added/removed, fallback to generic `messageReaction` handler.

### Phase 3: Samples & Docs
- Targeted messages sample bot (Teams-specific, group chat scenario).
- Reaction handler sample bot.
- Update docs-site with guides for both features.

---

## 6. Current State

| Feature | .NET | Node.js | Python |
|---------|------|---------|--------|
| `messageReaction` activity type | ✅ Recognized | ✅ In ActivityType enum | ✅ Recognized |
| `messageReaction` payload spec | ✅ [ActivityPayloads.md](./ActivityPayloads.md#messagereaction) | ✅ | ✅ |
| Reaction handler convenience | ❌ Not implemented | ❌ Not implemented | ❌ Not implemented |
| Reply-to-activity endpoint | ❌ Not in ConversationClient | ❌ Not in ConversationClient | ❌ Not in ConversationClient |
| Targeted message send | ❌ Not implemented | ❌ Not implemented | ❌ Not implemented |
| Targeted message update/delete | ❌ Not implemented | ❌ Not implemented | ❌ Not implemented |
| `MessageReaction` typed class | ❌ Not implemented | ❌ Not implemented | ❌ Not implemented |

---

## References

- [Bot Framework REST API Reference](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference)
- [Targeted Messages (Teams docs)](https://learn.microsoft.com/microsoftteams/platform/agents-in-teams/targeted-messages)
- [teams.net PR #338](https://github.com/microsoft/teams.net/pull/338)
- [teams.net Targeted Messages Sample](https://github.com/microsoft/teams.net/tree/main/Samples/Samples.TargetedMessages)
- [Activity Payloads — messageReaction](./ActivityPayloads.md#messagereaction)
- [Protocol Spec](./protocol.md)
