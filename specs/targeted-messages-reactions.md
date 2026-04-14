# Targeted Messages and Reactions Spec

**Purpose**: Define API surface for sending notification-only messages visible to specific users and adding reactions to messages.  
**Status**: Draft

---

## Overview

Microsoft Teams supports two features for rich bot interactions:

1. **Targeted Messages (Notification-Only Messages)**: Messages visible only to a specific user in a group conversation, without triggering the bot for other participants.
2. **Reactions**: Emoji reactions that bots can add to existing messages (e.g., 👍, ❤️, 🎉).

Both features require specialized Bot Framework API calls that the current `botas` ConversationClient does not expose.

---

## Problem

### Targeted Messages

Use case: A bot in a group chat needs to send a private notification to a specific user without sending it to everyone in the conversation.

**Current limitation:**
```typescript
// This sends to EVERYONE in the conversation
await ctx.send('Hello Alice!');
```

**What we need:**
```typescript
// This should be visible ONLY to Alice
await ctx.sendTargeted('Your approval is pending', aliceAccount);
```

### Reactions

Use case: A bot receives a message and wants to add a reaction (e.g., 👍) to acknowledge receipt without sending a reply.

**Current limitation:**
- No API to add reactions
- Developers must manually construct HTTP POST requests to `{serviceUrl}/v3/conversations/{conversationId}/activities/{activityId}/reactions`

**What we need:**
```typescript
// Add a thumbs-up reaction to the incoming message
await ctx.addReaction('👍');
```

---

## Solution

Add two new capabilities to the `ConversationClient` and `TurnContext`:

1. **Targeted message support**: `IsTargeted` flag on activities, query parameter in outbound requests
2. **Reaction support**: New `AddReactionAsync` / `addReaction` / `add_reaction` methods

### Design Principles

1. **Parity with teams.net PR #338**: Mirrors [ConversationClient changes](https://github.com/microsoft/teams.net/pull/338) that added `IsTargeted` and reaction support.
2. **Builder pattern**: Use existing `CoreActivityBuilder` for constructing targeted messages.
3. **Convenience methods**: High-level `TurnContext` methods for common use cases.
4. **HTTP transparency**: Query parameter `?isTargetedActivity=true` appended to Bot Framework URLs.

---

## API Surface

### .NET

#### Targeted Messages

```csharp
// Low-level: CoreActivity with IsTargeted flag
var activity = new CoreActivityBuilder()
    .WithConversationReference(context.Activity)
    .WithText("Hello Alice!")
    .WithRecipient(aliceAccount, isTargeted: true)
    .Build();

string activityId = await conversationClient.SendActivityAsync(activity, cancellationToken);

// High-level: TurnContext convenience method
await context.SendTargetedAsync("Hello Alice!", aliceAccount, cancellationToken);
```

**New types:**
```csharp
// CoreActivity property (existing class, new property)
public class CoreActivity
{
    [JsonIgnore]
    public bool IsTargeted { get; set; }
}

// CoreActivityBuilder method overload
public CoreActivityBuilder WithRecipient(ChannelAccount recipient, bool isTargeted = false)

// TurnContext convenience method
public Task<string> SendTargetedAsync(string text, ChannelAccount recipient, CancellationToken cancellationToken = default)
```

#### Reactions

```csharp
// Low-level: ConversationClient
await conversationClient.AddReactionAsync(
    conversationId: "19:meeting-123",
    activityId: "1234567890",
    reactionType: "like",
    serviceUrl: new Uri("https://smba.trafficmanager.net/amer/"),
    cancellationToken: cancellationToken
);

// High-level: TurnContext convenience method
await context.AddReactionAsync("like", cancellationToken);

// With custom reaction
await context.AddReactionAsync("❤️", cancellationToken);
```

**New methods:**
```csharp
// ConversationClient
public Task AddReactionAsync(
    string conversationId,
    string activityId,
    string reactionType,
    Uri serviceUrl,
    AgenticIdentity? agenticIdentity = null,
    CustomHeaders? customHeaders = null,
    CancellationToken cancellationToken = default)

// TurnContext
public Task AddReactionAsync(
    string reactionType,
    CancellationToken cancellationToken = default)
```

### Node.js

#### Targeted Messages

```typescript
// Low-level: CoreActivity with isTargeted flag
const activity = new CoreActivityBuilder()
    .withConversationReference(ctx.activity)
    .withText('Hello Alice!')
    .withRecipient(aliceAccount, true)  // isTargeted: true
    .build();

const activityId = await conversationClient.sendActivity(activity);

// High-level: TurnContext convenience method
await ctx.sendTargeted('Hello Alice!', aliceAccount);
```

**New types:**
```typescript
// CoreActivity property (existing interface, new property)
interface CoreActivity {
    isTargeted?: boolean;
}

// CoreActivityBuilder method overload
withRecipient(recipient: ChannelAccount, isTargeted?: boolean): this

// TurnContext convenience method
sendTargeted(text: string, recipient: ChannelAccount): Promise<string>
```

#### Reactions

```typescript
// Low-level: ConversationClient
await conversationClient.addReaction(
    '19:meeting-123',         // conversationId
    '1234567890',             // activityId
    'like',                   // reactionType
    new URL('https://smba.trafficmanager.net/amer/')  // serviceUrl
);

// High-level: TurnContext convenience method
await ctx.addReaction('like');

// With emoji
await ctx.addReaction('❤️');
```

**New methods:**
```typescript
// ConversationClient
async addReaction(
    conversationId: string,
    activityId: string,
    reactionType: string,
    serviceUrl: URL,
    agenticIdentity?: AgenticIdentity,
    customHeaders?: Record<string, string>
): Promise<void>

// TurnContext
async addReaction(reactionType: string): Promise<void>
```

### Python

#### Targeted Messages

```python
# Low-level: CoreActivity with is_targeted flag
activity = CoreActivityBuilder() \
    .with_conversation_reference(ctx.activity) \
    .with_text('Hello Alice!') \
    .with_recipient(alice_account, is_targeted=True) \
    .build()

activity_id = await conversation_client.send_activity(activity)

# High-level: TurnContext convenience method
await ctx.send_targeted('Hello Alice!', alice_account)
```

**New types:**
```python
# CoreActivity property (existing class, new attribute)
@dataclass
class CoreActivity:
    is_targeted: bool = False  # Not serialized

# CoreActivityBuilder method signature
def with_recipient(self, recipient: ChannelAccount, is_targeted: bool = False) -> CoreActivityBuilder

# TurnContext convenience method
async def send_targeted(self, text: str, recipient: ChannelAccount) -> str
```

#### Reactions

```python
# Low-level: ConversationClient
await conversation_client.add_reaction(
    conversation_id='19:meeting-123',
    activity_id='1234567890',
    reaction_type='like',
    service_url='https://smba.trafficmanager.net/amer/'
)

# High-level: TurnContext convenience method
await ctx.add_reaction('like')

# With emoji
await ctx.add_reaction('❤️')
```

**New methods:**
```python
# ConversationClient
async def add_reaction(
    self,
    conversation_id: str,
    activity_id: str,
    reaction_type: str,
    service_url: str,
    agentic_identity: AgenticIdentity | None = None,
    custom_headers: dict[str, str] | None = None
) -> None

# TurnContext
async def add_reaction(self, reaction_type: str) -> None
```

---

## Targeted Messages: Protocol Details

### HTTP Request

When `activity.IsTargeted` / `activity.isTargeted` / `activity.is_targeted` is `true`, the framework appends `?isTargetedActivity=true` to outbound Bot Framework URLs:

**Send activity:**
```
POST {serviceUrl}/v3/conversations/{conversationId}/activities?isTargetedActivity=true
```

**Update activity:**
```
PUT {serviceUrl}/v3/conversations/{conversationId}/activities/{activityId}?isTargetedActivity=true
```

**Delete activity:**
```
DELETE {serviceUrl}/v3/conversations/{conversationId}/activities/{activityId}?isTargetedActivity=true
```

### Query Parameter Rules

1. If URL already contains query parameters, append `&isTargetedActivity=true`
2. If URL has no query parameters, append `?isTargetedActivity=true`
3. Only append if `activity.IsTargeted === true`

### JSON Serialization

The `IsTargeted` property is **NOT serialized** in the JSON payload sent to Bot Framework:

```json
{
  "type": "message",
  "text": "Hello Alice!",
  "from": { "id": "28:bot-id" },
  "recipient": { "id": "29:user-id" }
}
```

It exists only in the SDK as a hint to append the query parameter.

### ConversationClient Responsibilities

The `ConversationClient.SendActivityAsync` / `sendActivity` / `send_activity` method MUST:

1. Check `activity.IsTargeted` / `isTargeted` / `is_targeted`
2. If `true`, append `?isTargetedActivity=true` to the target URL
3. Send the activity JSON (WITHOUT the IsTargeted property)

Example (.NET):
```csharp
public async Task<SendActivityResponse> SendActivityAsync(CoreActivity activity, ...)
{
    string url = $"{activity.ServiceUrl}/v3/conversations/{activity.Conversation.Id}/activities";
    
    if (activity.IsTargeted)
    {
        url += url.Contains('?') ? "&isTargetedActivity=true" : "?isTargetedActivity=true";
    }
    
    string body = activity.ToJson();  // IsTargeted not serialized
    // ... send HTTP POST
}
```

---

## Reactions: Protocol Details

### HTTP Request

Add a reaction to an existing activity:

```
POST {serviceUrl}/v3/conversations/{conversationId}/activities/{activityId}/reactions
Content-Type: application/json

{
  "type": "like"
}
```

### Supported Reaction Types

| Reaction Type | Display | Teams Support |
|--------------|---------|---------------|
| `like` | 👍 | ✅ |
| `heart` | ❤️ | ✅ |
| `laugh` | 😂 | ✅ |
| `surprised` | 😮 | ✅ |
| `sad` | 😢 | ✅ |
| `angry` | 😠 | ✅ |

**Emoji shorthand**: Frameworks MAY accept emoji strings (e.g., `"❤️"`) and map them to reaction types. Recommended mapping:

| Emoji | Reaction Type |
|-------|---------------|
| `👍` | `like` |
| `❤️` | `heart` |
| `😂` | `laugh` |
| `😮` | `surprised` |
| `😢` | `sad` |
| `😠` | `angry` |

If an emoji is NOT in the mapping, pass it as-is to the Bot Framework API (which may accept or reject it).

### ConversationClient Method

```
AddReactionAsync(conversationId, activityId, reactionType, serviceUrl, ...)
```

**Responsibilities:**
1. Construct URL: `{serviceUrl}/v3/conversations/{conversationId}/activities/{activityId}/reactions`
2. Serialize body: `{ "type": reactionType }`
3. Send HTTP POST with bearer token (from TokenManager)
4. Return on success (200/201), throw on failure

### TurnContext Method

```
AddReactionAsync(reactionType)
```

**Responsibilities:**
1. Extract `conversationId`, `activityId`, `serviceUrl` from `context.Activity`
2. Delegate to `conversationClient.AddReactionAsync(...)`

**Default target**: Reacts to the **incoming activity** that triggered the current turn.

To react to a DIFFERENT activity, use the low-level ConversationClient method directly.

---

## Example Scenarios

### Scenario 1: Private Approval Request

A bot in a group chat needs to send an approval request visible only to a manager:

```typescript
app.on('message', async (ctx) => {
    if (ctx.activity.text === 'request approval') {
        const manager = { id: '29:manager-id', name: 'Alice' };
        
        // Send targeted message to manager only
        await ctx.sendTargeted(
            'Approval request from Bob. Reply "approve" or "reject".',
            manager
        );
        
        // Send confirmation to everyone
        await ctx.send('Approval request sent to manager.');
    }
});
```

### Scenario 2: Bot Acknowledgment with Reaction

A bot wants to acknowledge receipt of a message without sending a reply:

```typescript
app.on('message', async (ctx) => {
    if (ctx.activity.text.startsWith('!report')) {
        // Add a reaction to acknowledge receipt
        await ctx.addReaction('👍');
        
        // Process report in background (no reply message)
        processReport(ctx.activity.text);
    }
});
```

### Scenario 3: Celebration Reaction

A bot celebrates a user's milestone:

```typescript
app.on('message', async (ctx) => {
    if (ctx.activity.text === 'I completed the course!') {
        // Add celebration reactions
        await ctx.addReaction('🎉');
        await ctx.addReaction('❤️');
        
        // Send congratulations message
        await ctx.send('Congratulations! 🎓');
    }
});
```

---

## Cross-Language Parity Table

### Targeted Messages

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Activity property | `IsTargeted` (bool) | `isTargeted` (boolean) | `is_targeted` (bool) |
| Builder method | `WithRecipient(recipient, isTargeted)` | `withRecipient(recipient, isTargeted)` | `with_recipient(recipient, is_targeted)` |
| TurnContext convenience | `SendTargetedAsync(text, recipient, ct)` | `sendTargeted(text, recipient)` | `send_targeted(text, recipient)` |
| Query parameter | `?isTargetedActivity=true` | `?isTargetedActivity=true` | `?isTargetedActivity=true` |
| JSON serialization | NOT serialized (`[JsonIgnore]`) | NOT serialized (omitted) | NOT serialized (exclude from `to_dict()`) |

### Reactions

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| ConversationClient method | `AddReactionAsync(convId, actId, type, url, ...)` | `addReaction(convId, actId, type, url, ...)` | `add_reaction(conv_id, act_id, type, url, ...)` |
| TurnContext convenience | `AddReactionAsync(type, ct)` | `addReaction(type)` | `add_reaction(type)` |
| Endpoint | `POST .../activities/{id}/reactions` | `POST .../activities/{id}/reactions` | `POST .../activities/{id}/reactions` |
| Payload | `{ "type": "like" }` | `{ "type": "like" }` | `{ "type": "like" }` |
| Emoji mapping | Optional (👍 → like) | Optional (👍 → like) | Optional (👍 → like) |

---

## Implementation Notes

### .NET

1. Add `IsTargeted` property to `CoreActivity` with `[JsonIgnore]` attribute
2. Add overload to `CoreActivityBuilder.WithRecipient(recipient, isTargeted)`
3. Update `ConversationClient.SendActivityAsync` to check `activity.IsTargeted` and append query parameter
4. Update `ConversationClient.UpdateActivityAsync` and `DeleteActivityAsync` similarly
5. Add `ConversationClient.AddReactionAsync(conversationId, activityId, reactionType, serviceUrl, ...)`
6. Add `TurnContext.SendTargetedAsync(text, recipient, cancellationToken)`
7. Add `TurnContext.AddReactionAsync(reactionType, cancellationToken)`
8. Write tests for:
   - IsTargeted flag preservation during activity copy constructor
   - Query parameter appending (with/without existing query params)
   - JSON serialization excludes IsTargeted
   - Reaction endpoint URL construction
   - Emoji-to-type mapping (if implemented)

### Node.js

1. Add `isTargeted?: boolean` to `CoreActivity` interface
2. Add `isTargeted` parameter to `CoreActivityBuilder.withRecipient(recipient, isTargeted?)`
3. Update `ConversationClient.sendActivity` to check `activity.isTargeted` and append query parameter
4. Update `updateActivity` and `deleteActivity` similarly
5. Add `ConversationClient.addReaction(conversationId, activityId, reactionType, serviceUrl, ...)`
6. Add `TurnContext.sendTargeted(text, recipient)`
7. Add `TurnContext.addReaction(reactionType)`
8. Ensure `activity.isTargeted` is omitted from JSON when serializing (use custom serializer or delete before JSON.stringify)
9. Write tests parallel to .NET

### Python

1. Add `is_targeted: bool = False` to `CoreActivity` dataclass
2. Add `is_targeted` parameter to `CoreActivityBuilder.with_recipient(recipient, is_targeted=False)`
3. Update `ConversationClient.send_activity` to check `activity.is_targeted` and append query parameter
4. Update `update_activity` and `delete_activity` similarly
5. Add `ConversationClient.add_reaction(conversation_id, activity_id, reaction_type, service_url, ...)`
6. Add `TurnContext.send_targeted(text, recipient)`
7. Add `TurnContext.add_reaction(reaction_type)`
8. Ensure `is_targeted` is excluded from `to_dict()` serialization (use `field(metadata={'serialize': False})` or equivalent)
9. Write tests parallel to .NET

---

## Open Questions

1. **Should `sendTargeted` support Adaptive Cards or only text?**
   - Proposal: Phase 1 = text only. Phase 2 = full activity (attachments, etc.)
   - Rationale: Keeps convenience method simple. Advanced scenarios use builder.

2. **Should reactions support bulk addition?**
   - Proposal: Not in Phase 1. Call `addReaction` multiple times if needed.
   - Rationale: Bot Framework API accepts one reaction per POST.

3. **Should we validate reaction types?**
   - Proposal: No. Pass through to Bot Framework; let it reject invalid types.
   - Rationale: Avoids maintenance burden if Teams adds new reaction types.

4. **Should targeted messages work for direct (1:1) conversations?**
   - Proposal: Yes, but it's redundant (all messages in 1:1 are already private).
   - Rationale: No harm in allowing it; framework doesn't need to enforce this.

---

## References

- [teams.net PR #338](https://github.com/microsoft/teams.net/pull/338) — Reference implementation for targeted messages and reactions
- [teams.net ConversationClient.cs](https://github.com/microsoft/teams.net/blob/next/core/src/Microsoft.Teams.Bot.Core/ConversationClient.cs) — Targeted message query parameter logic
- [teams.net CoreActivity.cs](https://github.com/microsoft/teams.net/blob/next/core/src/Microsoft.Teams.Bot.Core/Schema/CoreActivity.cs) — `IsTargeted` property with `[JsonIgnore]`
- [Bot Framework Reactions API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-add-activity-reaction) — Protocol documentation
- [Teams Message Reactions](https://learn.microsoft.com/microsoftteams/platform/bots/how-to/conversations/subscribe-to-conversation-events#reactions-to-a-bot-message) — Teams-specific documentation
