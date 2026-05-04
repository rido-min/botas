# Teams Activity Spec

**Purpose**: Define the `TeamsActivity` and `TeamsActivityBuilder` types for Microsoft Teams bot scenarios.
**Status**: Implemented

---

## Overview

Microsoft Teams adds channel-specific metadata to activities. This spec defines:
- **TeamsActivity** — Extends CoreActivity with Teams-specific properties
- **TeamsActivityBuilder** — Fluent builder with Teams-specific helpers
- **Supporting types** — `TeamsChannelAccount`, `TeamsConversation`, `TeamsChannelData`, `SuggestedActions`, and Teams-specific entity/attachment helpers

**Design Principles:**
- **No shadow properties.** TeamsActivity does NOT use C# `new` to shadow base class properties. It adds non-overlapping Teams-specific properties and provides factory methods (`FromActivity`) to convert from CoreActivity.
- **Behavioral parity.** All three languages implement the same logical API surface with language-specific naming.
- **Builder composition.** TeamsActivityBuilder provides fluent methods returning `this`, with a final `Build()`/`build()`.

---

## TeamsActivity

Extends CoreActivity with these properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `channelData` | `TeamsChannelData?` | No | Teams-specific metadata (tenant, channel, team, meeting info) |
| `timestamp` | `DateTimeOffset?` (.NET) / `Date?` (Node/Python) | No | UTC timestamp when the activity was sent |
| `localTimestamp` | `DateTimeOffset?` (.NET) / `Date?` (Node/Python) | No | Local timestamp in the sender's timezone |
| `locale` | `string?` | No | Locale of the sender (e.g., `"en-US"`) |
| `localTimezone` | `string?` | No | IANA timezone string (e.g., `"America/New_York"`) |
| `suggestedActions` | `SuggestedActions?` | No | Quick reply buttons shown to the user |

**Inherited from CoreActivity** (unchanged): `Type`, `Id`, `ServiceUrl`, `Text`, `From`, `Recipient`, `Conversation`, `Entities`, `Attachments`, and extension data.

### Static Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `fromActivity(CoreActivity)` | `TeamsActivity` | Shallow copy / round-trip conversion of a `CoreActivity` typed as `TeamsActivity`. Field values (including `channelData` and account fields) are copied by reference, not deserialized into Teams-specific types. |
| `createBuilder()` | `TeamsActivityBuilder` | Create builder. **.NET and Python only.** Node.js does not expose a static factory — use `new TeamsActivityBuilder()` directly. |

### Instance Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `AddEntity(Entity)` | `void` | Appends an entity to the Entities collection. Creates the collection if null. |

**Serialization:** TeamsActivity serializes identically to CoreActivity (same JSON schema, camelCase, extension data preserved).

---

## TeamsChannelAccount

Extends `ChannelAccount` with Teams-specific identity fields.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Id` | `string` | Yes | Unique identifier (inherited from ChannelAccount) |
| `Name` | `string?` | No | Display name (inherited from ChannelAccount) |
| `AadObjectId` | `string?` | No | Azure AD object ID (inherited from ChannelAccount) |
| `Role` | `string?` | No | `"user"` or `"bot"` (inherited from ChannelAccount) |
| `Email` | `string?` | No | User's email address |
| `UserPrincipalName` | `string?` | No | User's UPN (e.g., `user@contoso.com`) |
| *(any other)* | *any* | No | Preserved as extension data |

**Serialization:** JSON field `userPrincipalName` (camelCase).

---

## TeamsConversation

Extends `Conversation` with Teams-specific conversation metadata.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Id` | `string` | Yes | Conversation identifier (inherited from Conversation) |
| `ConversationType` | `string?` | No | Type: `"personal"`, `"groupChat"`, `"channel"` |
| `TenantId` | `string?` | No | Azure AD tenant ID |
| `IsGroup` | `bool?` | No | True if this is a group conversation |
| `Name` | `string?` | No | Conversation display name (for channels) |
| *(any other)* | *any* | No | Preserved as extension data |

**Serialization:** JSON fields `conversationType`, `tenantId`, `isGroup`, `name` (camelCase).

---

## TeamsChannelData

Teams-specific channel metadata. Nested inside `activity.channelData`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Tenant` | `TenantInfo?` | No | Tenant information |
| `Channel` | `ChannelInfo?` | No | Channel information (for channel conversations) |
| `Team` | `TeamInfo?` | No | Team information |
| `Meeting` | `MeetingInfo?` | No | Meeting information (if activity is from a meeting) |
| `Notification` | `NotificationInfo?` | No | Notification settings (e.g., alert user) |
| *(any other)* | *any* | No | Preserved as extension data |

### TenantInfo

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Id` | `string?` | No | Azure AD tenant ID |

### ChannelInfo

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Id` | `string?` | No | Teams channel ID |
| `Name` | `string?` | No | Channel display name |

### TeamInfo

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Id` | `string?` | No | Teams team ID |
| `Name` | `string?` | No | Team display name |
| `AadGroupId` | `string?` | No | Azure AD group ID for the team |

**Serialization:** JSON field `aadGroupId` (camelCase).

### MeetingInfo

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Id` | `string?` | No | Meeting ID |

### NotificationInfo

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Alert` | `bool?` | No | If true, show a notification alert to the user |

> All Teams sub-types MUST preserve unknown JSON properties via extension data, same as CoreActivity.

---

## SuggestedActions

Quick reply buttons shown to the user (typically in 1:1 conversations).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Actions` | `CardAction[]` | Yes | List of action buttons |
| `To` | `string[]?` | No | Recipient IDs (usually empty; Teams infers from context) |

### CardAction

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Type` | `string` | Yes | Action type: `"imBack"`, `"postBack"`, `"openUrl"`, `"messageBack"` |
| `Title` | `string?` | No | Button text displayed to the user |
| `Value` | `string?` | No | Value sent back when the button is clicked |
| `Text` | `string?` | No | Text sent as a message when button is clicked |
| `DisplayText` | `string?` | No | Text shown in the conversation when button is clicked |
| `Image` | `string?` | No | URL of an icon to display on the button |
| *(any other)* | *any* | No | Preserved as extension data |

**Serialization:** JSON field `displayText` (camelCase).

---

## Entity and Attachment

### Entity (Mention, Place, etc.)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Type` | `string` | Yes | Entity type: `"mention"`, `"place"`, etc. |
| *(any other)* | *any* | No | Entity-specific fields preserved as extension data |

#### Mention Entity

A mention entity has `type: "mention"` and these additional fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Mentioned` | `ChannelAccount` | Yes | The account being mentioned |
| `Text` | `string?` | No | The mention text (e.g., `"<at>User</at>"`) |

### Attachment

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ContentType` | `string` | Yes | MIME type or card type (e.g., `"application/vnd.microsoft.card.adaptive"`) |
| `ContentUrl` | `string?` | No | URL to the file content (for file uploads) |
| `Content` | `object?` | No | Inline card JSON (for cards) |
| `Name` | `string?` | No | File name |
| `ThumbnailUrl` | `string?` | No | Thumbnail image URL |
| *(any other)* | *any* | No | Preserved as extension data |

**Serialization:** JSON fields `contentType`, `contentUrl`, `thumbnailUrl` (camelCase).

---

## TeamsActivityBuilder

Fluent builder for Teams activities. Provides Teams-specific helper methods on top of the core builder pattern.

### Inherited Methods

- `WithType(string)` / `withType(string)` / `with_type(str)`
- `WithServiceUrl(string)` / `withServiceUrl(string)` / `with_service_url(str)`
- `WithConversation(Conversation)` / `withConversation(Conversation)` / `with_conversation(Conversation)`
- `WithFrom(ChannelAccount)` / `withFrom(ChannelAccount)` / `with_from(ChannelAccount)`
- `WithRecipient(ChannelAccount)` / `withRecipient(ChannelAccount)` / `with_recipient(ChannelAccount)`
- `WithText(string)` / `withText(string)` / `with_text(str)`
- `WithConversationReference(CoreActivity)` — Copies routing fields, swaps from/recipient
- `Build()` / `build()` — Returns `TeamsActivity`

### Teams-Specific Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `WithChannelData(TeamsChannelData)` | `Builder` | Set channel data |
| `WithSuggestedActions(SuggestedActions)` | `Builder` | Set quick replies |
| `WithAttachment(Attachment)` | `Builder` | Set single attachment (replaces collection) |
| `WithAdaptiveCardAttachment(cardJson)` | `Builder` | Set single Adaptive Card attachment (replaces collection) |
| `AddEntity(Entity)` | `Builder` | Append entity |
| `AddAttachment(Attachment)` | `Builder` | Append attachment |
| `AddMention(ChannelAccount, string?)` | `Builder` | Add mention entity |
| `AddAdaptiveCardAttachment(cardJson)` | `Builder` | Append Adaptive Card attachment |

**Note:** `AddMention(account, mentionText?)` creates a mention entity but does NOT modify the activity text. The caller must include `<at>Name</at>` in `WithText()`.

**Note:** `AddAdaptiveCardAttachment` and `WithAdaptiveCardAttachment` accept both string (JSON) and object types (`JsonElement`/`Record`/`dict`). Invalid JSON throws an exception.

---

## Design Decisions

### 1. No Shadow Properties

TeamsActivity does NOT use C# `new` keyword to shadow `From`, `Recipient`, `Conversation` with more specific types. Instead, developers cast when needed: `(TeamsChannelAccount)activity.From`.

**Rationale:** Avoids C# shadow complexity, simplifies JSON deserialization, and makes intent explicit.

### 2. Mention Helper Does Not Modify Text

`AddMention(account)` adds an entity but does NOT touch the activity text. The developer must call both `WithText("Hello <at>User</at>!")` and `AddMention(user)`.

**Rationale:** Text modification is context-specific (prepend? append? replace?). Explicit is better.

### 3. Extension Data Preservation

All Teams types (TeamsChannelData, TenantInfo, ChannelInfo, etc.) preserve unknown JSON properties via extension data, matching the CoreActivity contract.

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
- [Adaptive Cards Schema](https://adaptivecards.io/explorer/)
