# Targeted Messages & Reply-to-ID Spec

**Purpose**: Define support for Teams targeted messages and reply-to-ID for threading replies to specific messages.  
**Status**: Draft

---

## Overview

Two new capabilities extend the existing Teams activity model:

| Feature | Description |
|---------|-------------|
| **Targeted Messages** | Send messages visible only to specific users in a group chat or channel |
| **Reply-to-ID** | Reply to (or thread from) a specific message by its activity ID |

Both features build on the existing `TeamsActivityBuilder` and `ConversationClient` infrastructure. No new HTTP endpoints are introduced — these features use the existing `POST .../activities` and `POST .../activities/{replyToId}` routes with additional payload fields.

---

## Targeted Messages

### Problem

Bots in Teams group chats or channels sometimes need to send a message that only a specific user can see — for example, a private reminder, a personalized onboarding prompt, or a sensitive notification. Today, developers must manually construct the `channelData.feed` structure, which is undocumented in the botas library.

### Solution

Add a `FeedInfo` type to `TeamsChannelData` and a convenience builder method.

### FeedInfo

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `FeedType` | `string` | Yes | Feed type, typically `"PrivateReply"` for targeted messages |
| `FeedTargetAudience` | `string[]` | Yes | Azure AD object IDs of the users who should see the message |

**Serialization:** JSON fields `feedType`, `feedTargetAudience` (camelCase).

### TeamsChannelData Changes

Add a new `feed` property:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Feed` | `FeedInfo?` | No | Feed targeting information for targeted messages |

### TeamsActivityBuilder — New Method

| Method | Returns | Description |
|--------|---------|-------------|
| `WithTargetedAudience(userIds)` | `TeamsActivityBuilder` | Sets `channelData.feed` with `feedType: "PrivateReply"` and the given user Azure AD IDs as the audience. Creates the `channelData` if not already set. |

### Example Usage

**.NET:**
```csharp
var reply = new TeamsActivityBuilder()
    .WithConversationReference(ctx.Activity)
    .WithText("This is only visible to you!")
    .WithTargetedAudience("aadObjectId-of-user")
    .Build();
await ctx.SendAsync(reply, ct);
```

**Node.js:**
```typescript
const reply = new TeamsActivityBuilder()
    .withConversationReference(ctx.activity)
    .withText('This is only visible to you!')
    .withTargetedAudience('aadObjectId-of-user')
    .build()
await ctx.send(reply)
```

**Python:**
```python
reply = TeamsActivityBuilder() \
    .with_conversation_reference(ctx.activity) \
    .with_text("This is only visible to you!") \
    .with_targeted_audience("aadObjectId-of-user") \
    .build()
await ctx.send(reply)
```

### Expected JSON

```json
{
  "type": "message",
  "text": "This is only visible to you!",
  "channelData": {
    "feed": {
      "feedType": "PrivateReply",
      "feedTargetAudience": ["aadObjectId-of-user"]
    }
  }
}
```

---

## Reply-to-ID

### Problem

Bots frequently need to reply to a specific message — for example, to create a threaded reply in a Teams channel, or to reference the original message in a conversation. The `replyToId` field exists in the Bot Framework Activity schema but is not currently supported in the botas library types or builders.

Additionally, when `replyToId` is set on an outbound activity, the `ConversationClient` should POST to the reply-specific endpoint: `POST .../activities/{replyToId}`.

### Solution

1. Add `replyToId` as a typed property on `TeamsActivity`.
2. Add a builder method `WithReplyToId(activityId)`.
3. Update `ConversationClient` to use the `replyToId`-aware URL when the activity carries this field.

### TeamsActivity Changes

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `ReplyToId` | `string?` | No | ID of the message being replied to |

**Serialization:** JSON field `replyToId` (camelCase).

### TeamsActivityBuilder — New Method

| Method | Returns | Description |
|--------|---------|-------------|
| `WithReplyToId(activityId)` | `TeamsActivityBuilder` | Sets the `replyToId` on the activity |

### ConversationClient Changes

When sending an activity, if the activity carries a `replyToId` field, the client MUST use the reply-specific endpoint:

```
POST {serviceUrl}v3/conversations/{conversationId}/activities/{replyToId}
```

If `replyToId` is absent or empty, the existing endpoint is used:

```
POST {serviceUrl}v3/conversations/{conversationId}/activities
```

### Example Usage

**.NET:**
```csharp
var reply = new TeamsActivityBuilder()
    .WithConversationReference(ctx.Activity)
    .WithText("This is a threaded reply!")
    .WithReplyToId(ctx.Activity.Properties["id"]?.ToString())
    .Build();
await ctx.SendAsync(reply, ct);
```

**Node.js:**
```typescript
const reply = new TeamsActivityBuilder()
    .withConversationReference(ctx.activity)
    .withText('This is a threaded reply!')
    .withReplyToId(ctx.activity.properties?.id as string)
    .build()
await ctx.send(reply)
```

**Python:**
```python
reply = TeamsActivityBuilder() \
    .with_conversation_reference(ctx.activity) \
    .with_text("This is a threaded reply!") \
    .with_reply_to_id(ctx.activity.model_extra.get("id", "")) \
    .build()
await ctx.send(reply)
```

---

## Language-Specific API Surface

### .NET

```csharp
// New type
public class FeedInfo
{
    [JsonPropertyName("feedType")] public string? FeedType { get; set; }
    [JsonPropertyName("feedTargetAudience")] public string[]? FeedTargetAudience { get; set; }
}

// TeamsChannelData — new property
public class TeamsChannelData
{
    // ... existing properties ...
    [JsonPropertyName("feed")] public FeedInfo? Feed { get; set; }
}

// TeamsActivity — new property
public class TeamsActivity : CoreActivity
{
    // ... existing properties ...
    [JsonPropertyName("replyToId")] public string? ReplyToId { get; set; }
}

// TeamsActivityBuilder — new methods
public class TeamsActivityBuilder
{
    public TeamsActivityBuilder WithReplyToId(string? replyToId) { ... }
    public TeamsActivityBuilder WithTargetedAudience(params string[] userIds) { ... }
}
```

### Node.js

```typescript
// New type
export interface FeedInfo {
    feedType?: string
    feedTargetAudience?: string[]
    [key: string]: unknown
}

// TeamsChannelData — new property
export interface TeamsChannelData {
    // ... existing properties ...
    feed?: FeedInfo
}

// TeamsActivity — new property
export interface TeamsActivity extends CoreActivity {
    // ... existing properties ...
    replyToId?: string
}

// TeamsActivityBuilder — new methods
export class TeamsActivityBuilder {
    withReplyToId(activityId: string): this { ... }
    withTargetedAudience(...userIds: string[]): this { ... }
}
```

### Python

```python
# New type
class FeedInfo(_CamelModel):
    feed_type: str | None = None
    feed_target_audience: list[str] | None = None

# TeamsChannelData — new property
class TeamsChannelData(_CamelModel):
    # ... existing properties ...
    feed: FeedInfo | None = None

# TeamsActivity — new property
class TeamsActivity(CoreActivity):
    # ... existing properties ...
    reply_to_id: str | None = None

# TeamsActivityBuilder — new methods
class TeamsActivityBuilder:
    def with_reply_to_id(self, activity_id: str) -> "TeamsActivityBuilder": ...
    def with_targeted_audience(self, *user_ids: str) -> "TeamsActivityBuilder": ...
```

---

## Testing Requirements

### Targeted Messages

1. Builder sets `channelData.feed` with correct `feedType` and `feedTargetAudience`
2. Builder creates `channelData` if not already set when `WithTargetedAudience` is called
3. Builder preserves existing `channelData` properties when `WithTargetedAudience` is called

### Reply-to-ID

1. Builder sets `replyToId` on the activity
2. `ConversationClient` appends `/{replyToId}` to the endpoint URL when present
3. `ConversationClient` uses the standard endpoint when `replyToId` is absent

---

## References

- [Teams Activity Spec](./teams-activity.md) — Base types and builder pattern
- [Protocol Spec](./protocol.md) — HTTP contract for outbound activities
- [Microsoft Teams Targeted Messages](https://learn.microsoft.com/en-us/microsoftteams/platform/agents-in-teams/targeted-messages)
- [Bot Framework REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference)
