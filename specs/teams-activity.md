# Teams Activity Spec

**Purpose**: Define the `TeamsActivity` and `TeamsActivityBuilder` types for Microsoft Teams bot scenarios.
**Status**: Draft

---

## Overview

Microsoft Teams adds channel-specific metadata to activities. This spec defines:
- **TeamsActivity** — Extends CoreActivity with Teams-specific properties
- **TeamsActivityBuilder** — Fluent builder with Teams-specific helpers

---

## TeamsActivity

Extends CoreActivity with these properties:

| Property | Type | Description |
|----------|------|-------------|
| `channelData` | `TeamsChannelData?` | Teams-specific metadata |
| `timestamp` | `Date?` | UTC timestamp |
| `locale` | `string?` | Sender locale (e.g., `"en-us"`) |
| `localTimestamp` | `DateTimeOffset?` | Sender's local time |
| `localTimezone` | `string?` | Sender's timezone (e.g., `"America/New_York"`) |
| `suggestedActions` | `SuggestedActions?` | Quick reply buttons |

### Static Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `fromActivity(CoreActivity)` | `TeamsActivity` | Convert from CoreActivity |
| `createBuilder()` | `TeamsActivityBuilder` | Create builder |

---

## TeamsChannelAccount

Extends ChannelAccount with Teams identity:

| Property | Type | Description |
|----------|------|-------------|
| `email` | `string?` | User's email |
| `userPrincipalName` | `string?` | User's UPN |

---

## TeamsChannelData

Teams-specific channel metadata:

| Property | Type | Description |
|----------|------|-------------|
| `tenant` | `TenantInfo?` | Tenant ID |
| `channel` | `ChannelInfo?` | Channel info |
| `team` | `TeamInfo?` | Team info |
| `meeting` | `MeetingInfo?` | Meeting info |
| `notification` | `NotificationInfo?` | Teams notification settings |
| `teamsConversation` | `TeamsConversation?` | Extended conversation metadata |

### Sub-types

```
TenantInfo:         { id: string? }
ChannelInfo:        { id: string?, name: string? }
TeamInfo:           { id: string?, name: string?, aadGroupId: string? }
MeetingInfo:        { id: string? }
NotificationInfo:   { alert: boolean? }
TeamsConversation:  extends Conversation { conversationType: string?, tenantId: string?, isGroup: boolean?, name: string? }
```

> All Teams sub-types (TenantInfo, ChannelInfo, TeamInfo, MeetingInfo, NotificationInfo, TeamsChannelData) MUST preserve unknown JSON properties via extension data, same as CoreActivity.

---

## TeamsActivityBuilder

Fluent builder for Teams activities. `TeamsActivityBuilder` is a **standalone class** — it does NOT extend `CoreActivityBuilder`. It builds `TeamsActivity` objects directly with all Teams-specific fields.

> **Design rationale**: `TeamsActivityBuilder` manages a `TeamsActivity` instance internally and provides its own routing and text methods. This avoids coupling to `CoreActivityBuilder`'s internal structure and allows `build()` to return a `TeamsActivity` (not a plain `CoreActivity`).

### Methods

All routing methods (`withConversationReference`, `withServiceUrl`, `withConversation`, `withFrom`, `withRecipient`, `withType`, `withText`) are re-implemented on `TeamsActivityBuilder` (same signatures as `CoreActivityBuilder`).

### Teams-Specific Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `withChannelData(TeamsChannelData)` | `Builder` | Set channel data |
| `withSuggestedActions(SuggestedActions)` | `Builder` | Set quick replies |
| `withAttachment(Attachment)` | `Builder` | Set single attachment |
| `withAdaptiveCardAttachment(cardJson)` | `Builder` | Add Adaptive Card (Node/Python: `addAdaptiveCardAttachment`, .NET: `WithAdaptiveCardAttachment`) |
| `addEntity(Entity)` | `Builder` | Append entity |
| `addAttachment(Attachment)` | `Builder` | Append attachment |
| `addMention(ChannelAccount, string?)` | `Builder` | Add mention entity |

**Note:** `addMention(account)` creates entity but does NOT modify text. Include `<at>Name</at>` in `withText()`.

---

## SuggestedActions

Quick reply buttons:

| Property | Type | Description |
|----------|------|-------------|
| `actions` | `CardAction[]` | Buttons (required) |
| `to` | `string[]?` | Channel accounts to target (optional — limits visibility) |

### CardAction

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | `"imBack"`, `"postBack"`, `"openUrl"`, `"messageBack"` |
| `title` | `string?` | Button text |
| `value` | `string?` | Value sent on click |
| `text` | `string?` | Text to send (for messageBack) |
| `displayText` | `string?` | Display text in chat (for messageBack) |
| `image` | `string?` | Icon image URL |

---

## Example

```csharp
// .NET
var reply = TeamsActivityBuilder.CreateBuilder()
    .WithConversationReference(activity)
    .WithText("Hello <at>User</at>!")
    .AddMention(activity.From)
    .AddAdaptiveCardAttachment(cardJson)
    .Build();
```

```typescript
// Node.js
const reply = new TeamsActivityBuilder()
    .withConversationReference(activity)
    .withText('Hello <at>User</at>!')
    .addMention(activity.from)
    .addAdaptiveCardAttachment(cardJson)
    .build();
```

```python
# Python
reply = TeamsActivityBuilder() \
    .with_conversation_reference(activity) \
    .with_text("Hello <at>User</at>!") \
    .add_mention(activity.from_account) \
    .add_adaptive_card_attachment(card_json) \
    .build()
```

---

## References

- [Activity Schema](./activity-schema.md)
- [Bot Service Activity Reference](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#activity-object)
- [Teams Channel Data](https://learn.microsoft.com/microsoftteams/platform/bots/how-to/conversations/conversation-messages#teams-channel-data)
