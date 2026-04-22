# Teams Activity Spec

**Purpose**: Define the `TeamsActivity` and `TeamsActivityBuilder` types that provide strongly-typed Teams-specific properties and helper methods for Microsoft Teams bot scenarios.  
**Status**: Draft

---

## Overview

While `CoreActivity` provides basic Bot Framework messaging, Microsoft Teams adds rich channel-specific metadata (channel data, tenant IDs, conversation types, adaptive cards, mentions) that applications frequently need. This spec defines:

1. **TeamsActivity** — Extends `CoreActivity` with typed Teams-specific properties.
2. **TeamsActivityBuilder** — Extends the `CoreActivityBuilder` pattern with Teams-specific fluent methods.
3. **Supporting types** — `TeamsChannelAccount`, `TeamsConversation`, `TeamsChannelData`, `SuggestedActions`, and Teams-specific entity/attachment helpers.

**Design Principles:**
- **No shadow properties.** TeamsActivity does NOT use C# `new` to shadow base class properties. Instead, it adds non-overlapping Teams-specific properties and provides factory methods (`FromActivity`) to convert from CoreActivity.
- **Behavioral parity.** All three languages (NET, Node.js, Python) implement the same logical API surface with language-specific naming.
- **Builder composition.** TeamsActivityBuilder extends the CoreActivityBuilder pattern (fluent methods returning `this`, final `Build()`/`build()`).

---

## Problem

Teams bots frequently need to:
- Access Teams-specific identity data (UPN, email, tenant ID)
- Read channel metadata (channel ID, team ID, conversation type)
- Parse channel data (tenant, meeting info, notification settings)
- Create mentions and adaptive card attachments
- Work with suggested actions (quick replies)

Today, developers must:
1. Cast `activity.channelData` to `dynamic`/`any`/`dict` and manually navigate nested objects.
2. Parse entities array to find mentions.
3. Manually construct attachment objects with correct JSON structure.

This is error-prone and requires intimate knowledge of Teams-specific JSON structures.

---

## Solution

Provide `TeamsActivity` with strongly-typed properties for common Teams scenarios, and `TeamsActivityBuilder` with helper methods for common operations like mentions and adaptive cards.

### Example Usage

**.NET:**
```csharp
// Read Teams-specific data
var teamsActivity = TeamsActivity.FromActivity(activity);
Console.WriteLine($"Tenant: {teamsActivity.ChannelData?.Tenant?.Id}");
Console.WriteLine($"User email: {teamsActivity.From?.Email}");

// Build a Teams reply with a mention
var reply = TeamsActivity.CreateBuilder()
    .WithConversationReference(activity)
    .WithText("Hello <at>User</at>!")
    .AddMention(activity.From)
    .WithAdaptiveCardAttachment(cardJson)
    .Build();
```

**Node.js:**
```ts
// Read Teams-specific data
const teamsActivity = TeamsActivity.fromActivity(activity);
console.log(`Tenant: ${teamsActivity.channelData?.tenant?.id}`);
console.log(`User email: ${teamsActivity.from?.email}`);

// Build a Teams reply with a mention
const reply = new TeamsActivityBuilder()
    .withConversationReference(activity)
    .withText('Hello <at>User</at>!')
    .addMention(activity.from)
    .withAdaptiveCardAttachment(cardJson)
    .build();
```

**Python:**
```python
# Read Teams-specific data
teams_activity = TeamsActivity.from_activity(activity)
print(f"Tenant: {teams_activity.channel_data.tenant.id}")
print(f"User email: {teams_activity.from_account.email}")

# Build a Teams reply with a mention
reply = TeamsActivityBuilder() \
    .with_conversation_reference(activity) \
    .with_text('Hello <at>User</at>!') \
    .add_mention(activity.from_account) \
    .with_adaptive_card_attachment(card_json) \
    .build()
```

---

## TeamsActivity

A strongly-typed activity for Teams scenarios. Adds Teams-specific properties to the CoreActivity base.

### Design: No Shadow Properties

**IMPORTANT:** TeamsActivity does NOT shadow `From`, `Recipient`, or `Conversation` with `new` keyword (C#) or similar patterns. Instead:

1. It inherits `From`, `Recipient`, `Conversation` from `CoreActivity` as `ChannelAccount`/`Conversation` base types.
2. When a `TeamsActivity` is constructed via `FromActivity()`, the parser attempts to deserialize the JSON into the richer types (`TeamsChannelAccount`, `TeamsConversation`). If the JSON contains Teams-specific fields (e.g., `email`, `tenantId`), they are preserved.
3. Developers can **cast** the properties when they know the activity is from Teams: `var teamsFrom = (TeamsChannelAccount)activity.From;`

This approach avoids C# shadow complexity while maintaining type safety where possible.

### Properties (Non-Overlapping with CoreActivity)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `ChannelData` | `TeamsChannelData?` | No | Teams-specific metadata (tenant, channel, team, meeting info) |
| `Timestamp` | `DateTimeOffset?` (.NET) / `Date?` (Node/Python) | No | UTC timestamp when the activity was sent |
| `LocalTimestamp` | `DateTimeOffset?` (.NET) / `Date?` (Node/Python) | No | Local timestamp in the sender's timezone |
| `Locale` | `string?` | No | Locale of the sender (e.g., `"en-US"`) |
| `LocalTimezone` | `string?` | No | IANA timezone string (e.g., `"America/New_York"`) |
| `SuggestedActions` | `SuggestedActions?` | No | Quick reply buttons shown to the user |

**Inherited from CoreActivity** (unchanged): `Type`, `Id`, `ServiceUrl`, `Text`, `From`, `Recipient`, `Conversation`, `Entities`, `Attachments`, and extension data.

### Static Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `FromActivity(CoreActivity)` | `TeamsActivity` | Creates a TeamsActivity from a CoreActivity. Attempts to deserialize channel data and account fields as Teams types. |
| `CreateBuilder()` | `TeamsActivityBuilder` | Factory method returning a new builder instance. |

### Instance Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `AddEntity(Entity)` | `void` | Appends an entity to the Entities collection. Creates the collection if null. |

**Serialization:** TeamsActivity serializes identically to CoreActivity (same JSON schema, camelCase, extension data preserved). The Teams-specific types are simply richer versions of the base types and serialize/deserialize according to their field definitions.

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

**Note:** Node.js and Python already have `TeamsChannelAccount` types. .NET will add this type in the TeamsActivity implementation.

**Serialization:** JSON field `userPrincipalName` (camelCase).

---

## TeamsConversation

Extends `Conversation` with Teams-specific conversation metadata.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Id` | `string` | Yes | Conversation identifier (inherited from Conversation) |
| `ConversationType` | `string?` | No | Type of conversation: `"personal"`, `"groupChat"`, `"channel"` |
| `TenantId` | `string?` | No | Azure AD tenant ID |
| `IsGroup` | `bool?` | No | True if this is a group conversation |
| `Name` | `string?` | No | Conversation display name (for channels) |
| *(any other)* | *any* | No | Preserved as extension data |

**Serialization:** JSON fields `conversationType`, `tenantId`, `isGroup`, `name` (camelCase).

---

## TeamsChannelData

Teams-specific channel metadata. This object is nested inside `activity.channelData`.

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

**Note:** The `channelData` structure is Teams-specific and may evolve. Implementations MUST preserve unknown fields as extension data.

---

## SuggestedActions

Quick reply buttons shown to the user (typically in 1:1 conversations).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `To` | `string[]?` | No | Recipient IDs (usually empty; Teams infers from context) |
| `Actions` | `CardAction[]` | Yes | List of action buttons |

### CardAction

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Type` | `string` | Yes | Action type: `"imBack"`, `"postBack"`, `"openUrl"`, `"messageBack"` |
| `Title` | `string?` | No | Button text displayed to the user |
| `Value` | `string?` | No | Value sent back when the button is clicked |
| `Text` | `string?` | No | Text sent as a message when button is clicked (imBack, messageBack) |
| `DisplayText` | `string?` | No | Text shown in the conversation when button is clicked |
| `Image` | `string?` | No | URL of an icon to display on the button |
| *(any other)* | *any* | No | Preserved as extension data |

**Serialization:** JSON field `displayText` (camelCase).

---

## Entity (Mention, Place, etc.)

Entities are used for mentions, locations, and other metadata. The base `Entity` type is already defined in Node.js and Python. .NET will add it.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Type` | `string` | Yes | Entity type: `"mention"`, `"place"`, etc. |
| *(any other)* | *any* | No | Entity-specific fields preserved as extension data |

### Mention Entity

A mention entity has `type: "mention"` and these additional fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Mentioned` | `ChannelAccount` | Yes | The account being mentioned |
| `Text` | `string?` | No | The mention text (e.g., `"<at>User</at>"`) |

**Serialization:** JSON field `mentioned` (camelCase).

**Usage:** When a user mentions a bot or another user, Teams includes a mention entity in the activity.

---

## Attachment

Attachments represent cards (Adaptive Cards, Hero Cards) or file uploads. The base `Attachment` type is already defined in Node.js and Python. .NET will add it.

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

Extends the `CoreActivityBuilder` fluent pattern with Teams-specific helper methods.

### Inherited Methods (from CoreActivityBuilder)

These are available because TeamsActivityBuilder extends CoreActivityBuilder:

- `WithType(string)` / `withType(string)` / `with_type(str)`
- `WithServiceUrl(string)` / `withServiceUrl(string)` / `with_service_url(str)`
- `WithConversation(Conversation)` / `withConversation(Conversation)` / `with_conversation(Conversation)`
- `WithFrom(ChannelAccount)` / `withFrom(ChannelAccount)` / `with_from(ChannelAccount)`
- `WithRecipient(ChannelAccount)` / `withRecipient(ChannelAccount)` / `with_recipient(ChannelAccount)`
- `WithText(string)` / `withText(string)` / `with_text(str)`
- `WithConversationReference(CoreActivity)` — Copies routing fields, swaps from/recipient
- `Build()` / `build()` — Returns `TeamsActivity`

### New Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `WithChannelData(TeamsChannelData)` | `TeamsActivityBuilder` | Sets the channel data |
| `WithSuggestedActions(SuggestedActions)` | `TeamsActivityBuilder` | Sets the suggested actions |
| `WithEntities(Entity[])` | `TeamsActivityBuilder` | Replaces the entities collection |
| `WithAttachments(Attachment[])` | `TeamsActivityBuilder` | Replaces the attachments collection |
| `WithAttachment(Attachment)` | `TeamsActivityBuilder` | Sets a single attachment (replaces collection with array of one) |
| `AddEntity(Entity)` | `TeamsActivityBuilder` | Appends an entity to the entities collection |
| `AddAttachment(Attachment)` | `TeamsActivityBuilder` | Appends an attachment to the attachments collection |
| `AddMention(ChannelAccount, string?)` | `TeamsActivityBuilder` | Creates a mention entity for the account and adds it to entities. Optional second parameter is the mention text (defaults to `"<at>{name}</at>"`) |
| `AddAdaptiveCardAttachment(string)` | `TeamsActivityBuilder` | Parses the JSON string as an Adaptive Card and appends it as an attachment with `contentType: "application/vnd.microsoft.card.adaptive"` |
| `WithAdaptiveCardAttachment(string)` | `TeamsActivityBuilder` | Same as `AddAdaptiveCardAttachment` but replaces the attachments collection (single attachment) |

**Note:** `AddMention` is a convenience method that:
1. Creates an entity with `type: "mention"`, `mentioned: account`, `text: mentionText`.
2. Appends it to the entities collection.
3. Does NOT modify the activity text — the caller is responsible for including the `<at>Name</at>` markup in the text.

**Note:** `AddAdaptiveCardAttachment` and `WithAdaptiveCardAttachment` parse the JSON string and set `content` to the parsed object. If the string is invalid JSON, the method throws an exception.

### Build Behavior

`Build()` / `build()` returns a `TeamsActivity` instance. All fields set via `With*` methods are copied into the new activity.

---

## Language-Specific API Surface

### .NET

```csharp
// File: dotnet/src/Botas/TeamsActivity.cs

public class TeamsActivity : CoreActivity
{
    public TeamsChannelData? ChannelData { get; set; }
    public DateTimeOffset? Timestamp { get; set; }
    public DateTimeOffset? LocalTimestamp { get; set; }
    public string? Locale { get; set; }
    public string? LocalTimezone { get; set; }
    public SuggestedActions? SuggestedActions { get; set; }

    // Factory
    public static TeamsActivity FromActivity(CoreActivity activity) { ... }
    
    // Builder factory
    public static TeamsActivityBuilder CreateBuilder() => new TeamsActivityBuilder();

    // Helper
    public void AddEntity(Entity entity) { ... }
}

// File: dotnet/src/Botas/TeamsActivityBuilder.cs

public class TeamsActivityBuilder : CoreActivityBuilder
{
    public TeamsActivityBuilder WithChannelData(TeamsChannelData? channelData) { ... }
    public TeamsActivityBuilder WithSuggestedActions(SuggestedActions? suggestedActions) { ... }
    public TeamsActivityBuilder WithEntities(Entity[]? entities) { ... }
    public TeamsActivityBuilder WithAttachments(Attachment[]? attachments) { ... }
    public TeamsActivityBuilder WithAttachment(Attachment attachment) { ... }
    public TeamsActivityBuilder AddEntity(Entity entity) { ... }
    public TeamsActivityBuilder AddAttachment(Attachment attachment) { ... }
    public TeamsActivityBuilder AddMention(ChannelAccount account, string? mentionText = null) { ... }
    public TeamsActivityBuilder AddAdaptiveCardAttachment(string cardJson) { ... }
    public TeamsActivityBuilder AddAdaptiveCardAttachment(JsonElement content) { ... }
    public TeamsActivityBuilder WithAdaptiveCardAttachment(string cardJson) { ... }
    public TeamsActivityBuilder WithAdaptiveCardAttachment(JsonElement content) { ... }
    
    // Override to return TeamsActivity instead of CoreActivity
    public new TeamsActivity Build() { ... }
}
```

**Note:** .NET will need to add these new types:
- `TeamsChannelAccount` (extends `ChannelAccount`)
- `TeamsConversation` (extends `Conversation`)
- `TeamsChannelData` (new)
- `TenantInfo`, `ChannelInfo`, `TeamInfo`, `MeetingInfo`, `NotificationInfo` (new)
- `SuggestedActions`, `CardAction` (new)
- `Entity` (new, with JsonExtensionData)
- `Attachment` (new, with JsonExtensionData)

**Serialization:** All types use `[JsonPropertyName]` for camelCase and `[JsonExtensionData]` for unknown fields.

### Node.js

```ts
// File: node/packages/botas-core/src/teams-activity.ts

export interface TeamsActivity extends CoreActivity {
  channelData?: TeamsChannelData;
  timestamp?: Date;
  localTimestamp?: Date;
  locale?: string;
  localTimezone?: string;
  suggestedActions?: SuggestedActions;
}

export namespace TeamsActivity {
  export function fromActivity(activity: CoreActivity): TeamsActivity { ... }
}

// File: node/packages/botas-core/src/teams-activity-builder.ts

export class TeamsActivityBuilder extends CoreActivityBuilder {
  withChannelData(channelData?: TeamsChannelData): this { ... }
  withSuggestedActions(suggestedActions?: SuggestedActions): this { ... }
  withEntities(entities?: Entity[]): this { ... }
  withAttachments(attachments?: Attachment[]): this { ... }
  withAttachment(attachment: Attachment): this { ... }
  addEntity(entity: Entity): this { ... }
  addAttachment(attachment: Attachment): this { ... }
  addMention(account: ChannelAccount, mentionText?: string): this { ... }
  addAdaptiveCardAttachment(card: string | Record<string, unknown>): this { ... }
  withAdaptiveCardAttachment(card: string | Record<string, unknown>): this { ... }
  
  // Override to return TeamsActivity instead of CoreActivity
  build(): TeamsActivity { ... }
}
```

**Note:** Node.js already has `TeamsChannelAccount`, `Entity`, `Attachment`. Will need to add:
- `TeamsConversation` (extends `Conversation`)
- `TeamsChannelData` and sub-types
- `SuggestedActions`, `CardAction`

### Python

```python
# File: python/packages/botas/src/botas/teams_activity.py

class TeamsActivity(CoreActivity):
    channel_data: TeamsChannelData | None = None
    timestamp: datetime | None = None
    local_timestamp: datetime | None = None
    locale: str | None = None
    local_timezone: str | None = None
    suggested_actions: SuggestedActions | None = None

    @staticmethod
    def from_activity(activity: CoreActivity) -> "TeamsActivity":
        ...

    def add_entity(self, entity: Entity) -> None:
        ...

# File: python/packages/botas/src/botas/teams_activity_builder.py

class TeamsActivityBuilder(CoreActivityBuilder):
    def with_channel_data(self, channel_data: TeamsChannelData | None) -> "TeamsActivityBuilder":
        ...
    
    def with_suggested_actions(self, suggested_actions: SuggestedActions | None) -> "TeamsActivityBuilder":
        ...
    
    def with_entities(self, entities: list[Entity] | None) -> "TeamsActivityBuilder":
        ...
    
    def with_attachments(self, attachments: list[Attachment] | None) -> "TeamsActivityBuilder":
        ...
    
    def with_attachment(self, attachment: Attachment) -> "TeamsActivityBuilder":
        ...
    
    def add_entity(self, entity: Entity) -> "TeamsActivityBuilder":
        ...
    
    def add_attachment(self, attachment: Attachment) -> "TeamsActivityBuilder":
        ...
    
    def add_mention(self, account: ChannelAccount, mention_text: str | None = None) -> "TeamsActivityBuilder":
        ...
    
    def add_adaptive_card_attachment(self, card: str | dict) -> "TeamsActivityBuilder":
        ...
    
    def with_adaptive_card_attachment(self, card: str | dict) -> "TeamsActivityBuilder":
        ...
    
    # Override to return TeamsActivity instead of CoreActivity
    def build(self) -> TeamsActivity:
        ...
```

**Note:** Python already has `TeamsChannelAccount`, `Entity`, `Attachment`. Will need to add:
- `TeamsConversation` (extends `Conversation`)
- `TeamsChannelData` and sub-types
- `SuggestedActions`, `CardAction`

---

## Implementation Roadmap

### Phase 1: Core Types (This Spec)

- `TeamsActivity` class/interface
- `TeamsActivityBuilder` class
- `TeamsChannelAccount` (add to .NET; already exists in Node/Python)
- `TeamsConversation` (add to all three languages)
- `TeamsChannelData` and sub-types (TenantInfo, ChannelInfo, TeamInfo, MeetingInfo, NotificationInfo)
- `SuggestedActions`, `CardAction`
- `Entity` (add to .NET; already exists in Node/Python)
- `Attachment` (add to .NET; already exists in Node/Python)

### Phase 2: Advanced Helpers (Deferred)

These are useful but not required for the initial TeamsActivity release:

- `CreateMeetingEventActivity()` — Factory for meeting start/end events
- `CreateO365ConnectorCardAttachment()` — Helper for O365 connector cards
- `WithReplyToId()` — Threaded replies
- `AddFileConsentCard()` — File upload consent flow
- `AddSignInCard()` — OAuth sign-in card
- Rich typing for specific entity types (Place, GeoCoordinates, etc.)

---

## Design Decisions

### 1. No Shadow Properties

**Decision:** TeamsActivity does NOT use C# `new` keyword to shadow `From`, `Recipient`, `Conversation` with more specific types.

**Rationale:**
- Shadow properties create confusion in C# (requires understanding of base/derived dispatch rules).
- Makes JSON deserialization more complex (which type to materialize?).
- Casting is more explicit: `(TeamsChannelAccount)activity.From` clearly signals intent.

**Impact:** Developers can use `FromActivity()` to get a TeamsActivity instance, then cast properties when needed. Serialization is cleaner (no duplicate properties in JSON).

### 2. Builder Inheritance (Not Generics)

**Decision:** TeamsActivityBuilder inherits from CoreActivityBuilder directly. No generic `CoreActivityBuilder<TActivity, TBuilder>` pattern.

**Rationale:**
- The reference implementation uses generics to enable chaining in derived builders.
- However, our CoreActivityBuilder already returns `this` (for C#) or `self` (for Python), enabling chaining without generics.
- Adding generics now would break the existing CoreActivityBuilder API and add complexity.

**Impact:** TeamsActivityBuilder methods return `TeamsActivityBuilder` explicitly. Developers cannot call `WithChannelData()` on a `CoreActivityBuilder` (expected and correct).

### 3. Entity/Attachment as Separate Types (Not JsonElement)

**Decision:** .NET will add strongly-typed `Entity` and `Attachment` classes (mirroring Node.js and Python) instead of using `JsonElement` or `JsonArray`.

**Rationale:**
- Cross-language parity: Node.js and Python already have these types.
- Developers can inspect/modify entities without manual JSON parsing.
- Maintains the `[JsonExtensionData]` pattern for forward compatibility.

**Impact:** .NET's `CoreActivity.Entities` and `CoreActivity.Attachments` will change from `JsonArray?` to `Entity[]?` and `Attachment[]?`. This is a breaking change for 0.1.x (acceptable).

### 4. Mention Helper Behavior

**Decision:** `AddMention(account, mentionText)` adds an entity but does NOT modify the activity text.

**Rationale:**
- Text modification is context-specific (where to insert the mention? prepend? append? replace?).
- Explicit is better: the developer sets the text with `WithText("Hello <at>User</at>!")` and calls `AddMention(user)` separately.
- Matches the Bot Framework mental model (mention entity describes a mention; text contains the markup).

**Impact:** Developers must call both `WithText()` and `AddMention()`. More explicit, less magic.

---

## Testing Strategy

### Unit Tests

Each language implementation MUST include:

1. **Deserialization tests:**
   - Parse a Teams activity JSON with `channelData`, `timestamp`, etc.
   - Assert fields are correctly populated.

2. **Serialization tests:**
   - Create a TeamsActivity programmatically.
   - Serialize to JSON.
   - Assert camelCase naming, null fields omitted, extension data preserved.

3. **FromActivity tests:**
   - Convert a CoreActivity with Teams JSON to TeamsActivity.
   - Assert Teams-specific fields are accessible.

4. **Builder tests:**
   - Use TeamsActivityBuilder to create an activity.
   - Assert all fields set via `With*` methods are present.
   - Test `AddMention()` creates correct entity.
   - Test `AddAdaptiveCardAttachment()` parses JSON correctly.

5. **Error cases:**
   - Invalid JSON in `AddAdaptiveCardAttachment()` throws exception.
   - Null handling (builder handles null collections gracefully).

### Cross-Language Parity Tests

1. Serialize a TeamsActivity in one language, deserialize in another.
2. Assert fields match (same JSON structure across languages).

---

## Acceptance Criteria

1. `TeamsActivity` type exists in all three languages with identical logical properties.
2. `TeamsActivityBuilder` type exists in all three languages with identical fluent methods.
3. All new sub-types (`TeamsChannelAccount`, `TeamsConversation`, `TeamsChannelData`, etc.) defined and serializable.
4. `FromActivity()` correctly converts a CoreActivity to TeamsActivity.
5. `AddMention()` creates a valid mention entity.
6. `AddAdaptiveCardAttachment()` parses JSON and creates attachment.
7. All unit tests pass in all three languages.
8. Documentation updated (README examples, API reference).
9. At least one sample demonstrates TeamsActivity usage (e.g., MentionBot extended with adaptive card).

---

## References

- [Activity Schema Spec](./activity-schema.md) — CoreActivity definition
- [Bot Spec — CoreActivityBuilder](./README.md#coreactivitybuilder) — Builder pattern reference
- [Microsoft Teams Activity Schema](https://learn.microsoft.com/microsoftteams/platform/bots/how-to/conversations/conversation-messages#teams-channel-data)
- [Adaptive Cards Schema](https://adaptivecards.io/explorer/)
- [Bot Framework Activity Reference](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#activity-object)
