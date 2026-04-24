# Activity Schema Spec

**Purpose**: Define the JSON payload structure for activities exchanged between bots and the Bot Service Service.
**Status**: Draft

> **Note**: Outbound activities are typically constructed using the fluent `CoreActivityBuilder`. See the [Bot Spec — CoreActivityBuilder](./README.md#coreactivitybuilder) for the API.

---

## Overview

All communication between a bot and the Bot Service Service uses **Activity** JSON objects. This document defines the schema and serialization rules.

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

### Inbound Activity Fields

Fields present on activities received from the Bot Service Service (`POST /api/messages`).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | **Yes** | Activity type (e.g., `"message"`) |

> **Known Activity Types:** The `type` field is an open string, but implementations provide type aliases for compile-time safety:
> - **Core** (`ActivityType`): `"message"` · `"typing"` · `"invoke"` — the types that `BotApplication` dispatches on.
> - **Teams** (`TeamsActivityType`): All core types plus `"event"` · `"conversationUpdate"` · `"messageUpdate"` · `"messageDelete"` · `"messageReaction"` · `"installationUpdate"`.
>
> Unrecognized type values are preserved and silently ignored by handler dispatch.
| `id` | `string` | No | Unique activity identifier (assigned by the channel) |
| `serviceUrl` | `string` | **Yes** | Callback URL for this conversation's channel |
| `channelId` | `string` | No | Channel identifier (e.g., `"msteams"`, `"webchat"`) |
| `text` | `string` | No | Message text content |
| `name` | `string` | No | Invoke action name (e.g., `"adaptiveCard/action"`). Used for [invoke dispatch](./invoke-activities.md). |
| `value` | `any` | No | Action-specific payload for invoke activities |
| `from` | [ChannelAccount](#channelaccount) | **Yes** | Sender information |
| `recipient` | [ChannelAccount](#channelaccount) | No | Recipient (the bot) |
| `conversation` | [Conversation](#conversation) | **Yes** | Conversation context |
| `entities` | `array` | No | Mentions, card actions, and other entities |
| `attachments` | `array` | No | File or card attachments |
| *(any other)* | *any* | No | Preserved as extension data |

### Outbound Activity Fields

Fields on activities sent by the bot via `ConversationClient`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | **Yes** | Activity type (defaults to `"message"`) |
| `text` | `string` | **Yes** (for messages) | Message text content |
| `from` | [ChannelAccount](#channelaccount) | No | Auto-populated from conversation reference |
| `recipient` | [ChannelAccount](#channelaccount) | No | Auto-populated from conversation reference |
| `conversation` | [Conversation](#conversation) | No | Auto-populated from conversation reference |
| `entities` | `array` | No | Mentions, card actions, and other entities |
| `attachments` | `array` | No | File or card attachments |
| *(any other)* | *any* | No | Preserved as extension data |

> **Python note**: `from` is a reserved keyword in Python. The Python implementation maps this field to `from_account` in the typed model, while serializing to/from `"from"` in JSON.

> **Default values**: When constructing a new `CoreActivity` programmatically (not deserializing), the `type` field defaults to `"message"` in the existing .NET implementation. Other implementations MAY use an empty string default. Callers should always set `type` explicitly.

---

## ChannelAccount

Represents a user or bot identity.

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

## Activity Types

| Type | Description | Key extension fields |
|------|-------------|---------------------|
| `message` | Text message from user or bot | `text` |
| `conversationUpdate` | Membership/metadata change | `membersAdded`, `membersRemoved` (extension data) |
| `messageReaction` | Reaction added/removed on a message | `reactionsAdded`, `reactionsRemoved`, `replyToId` (extension data) |
| `invoke` | Request-response card/task/extension action | `name`, `value` — see [Invoke Activities](./invoke-activities.md) |
| `installationUpdate` | Bot installed or uninstalled | `action` (`"add"` / `"remove"`, extension data) |
| `typing` | User or bot is composing | No text; use `ctx.sendTyping()` to send |

The type string is open-ended — implementations MUST support registering handlers for arbitrary type values. Unregistered types are silently ignored (see [Protocol — Handler Dispatch](./protocol.md#handler-dispatch)).

> **Extension fields**: Fields like `membersAdded`, `reactionsAdded`, and `action` are not typed on `CoreActivity`. Access them via the extension/properties dictionary.

---

## Extension Data Round-Trip

All activity types may carry additional properties beyond the typed fields. BotAS preserves these as extension data, so custom channel data round-trips safely. Both `customField` and `channelData` in the example below are preserved in the extension dictionary. See [Serialization Rules](#serialization-rules).

```json
{
  "type": "message",
  "text": "Hello",
  "customField": "preserved",
  "channelData": { "tenant": { "id": "tenant-guid" } }
}
```

---

## References

- [Protocol Spec](./protocol.md) — HTTP contract for sending/receiving activities
- [Bot Service Activity Schema](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#activity-object)
