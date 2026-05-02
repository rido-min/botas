# Activity Schema Spec

**Purpose**: Define the JSON payload structure for activities exchanged between bots and the Bot Service Service.
**Status**: Draft

> **Note**: Outbound activities are typically constructed using the fluent `CoreActivityBuilder`. See [Architecture — Components](./architecture.md#components) for the API.

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
| **Extension data** | Preserve all unknown/unrecognized properties in a named dictionary or equivalent structure. These MUST survive a round-trip (deserialize → serialize) without data loss. Implementations MUST use a named properties field or equivalent mechanism (e.g., `properties?: Record<string, unknown>` in Node.js, `[JsonExtensionData] Dictionary<string, object?>` in .NET, Pydantic `model_extra` in Python) to maintain type safety. Extension data MUST also be preserved on sub-objects (`ChannelAccount`, `Conversation`, Teams models, etc.). |

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
| `id` | `string` | No | Unique activity identifier (assigned by the channel). |
| `serviceUrl` | `string` | **Yes** | Callback URL for this conversation's channel |
| `channelId` | `string` | No | Channel identifier (e.g., `"msteams"`, `"webchat"`). |
| `text` | `string` | No | Message text content |
| `name` | `string` | No | Invoke action name (e.g., `"adaptiveCard/action"`). Used for [invoke dispatch](./invoke-activities.md). |
| `value` | `any` | No | Action-specific payload. Present on invoke activities (e.g., `adaptiveCard/action`) and on message activities produced by Adaptive Card `Action.Submit` buttons. See [Card Actions — Action.Submit vs Action.Execute](./invoke-activities.md#actionsubmit-vs-actionexecute). |
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

> **Python note**: `from` is a reserved keyword in Python. The Python implementation maps this field to `from_account` in the typed model, while serializing to/from `"from"` in JSON. This remapping MUST be implemented as a Pydantic `@model_validator(mode="before")` to handle all deserialization paths (JSON string via `model_validate_json`, dict via `model_validate`, and keyword args). A `model_dump` override MUST also remap `from_account` back to `from` in the output dict. Both `CoreActivity` and `TeamsActivity` (if it extends `CoreActivity`) require this validator.

> **Default values**: When constructing a new `CoreActivity` programmatically (not deserializing), the `type` field defaults to `"message"` in the builder (`CoreActivityBuilder`). When constructing `CoreActivity` directly, the `type` field MUST default to an empty string (`""`) — NOT `"message"`. This prevents accidentally sending activities with the wrong type. Callers MUST set `type` explicitly when constructing activities outside the builder.
>
> **Language note (.NET)**: The .NET `CoreActivity` uses a primary constructor with `string type = "message"`. This means `new CoreActivity()` produces `Type = "message"` (not `""`). .NET MAY use `"message"` as the default via its primary constructor as a language-specific convenience. Other languages (`new CoreActivity()` in Node.js, `CoreActivity()` in Python) produce an empty `type`. See [Language-Specific Differences](./README.md#language-specific-intentional-differences).

> **Field optionality**: Inbound activities (from Bot Service) always carry `type`, `serviceUrl`, `from`, and `conversation` — these are effectively required on the wire. Outbound activities only require `type` and `text` (for messages); routing fields are auto-populated by `TurnContext.send()` or set manually. Type systems SHOULD reflect this: inbound processing can assume these fields are present, while outbound construction allows them to be omitted.

---

## ChannelAccount

Represents a user or bot identity.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | No | Display name |

> **Type-level modeling**: Required fields (`id`) MUST be modeled as non-optional at the type level (e.g., `id: string` not `id?: string`, `id: str` not `id: str | None`). This ensures that constructing a `ChannelAccount` without an `id` is a compile-time or validation error.
| `aadObjectId` | `string` | No | Azure AD object ID |
| `role` | `string` | No | `"user"` or `"bot"` |
| *(any other)* | *any* | No | Preserved as extension data |

---

## Conversation

Minimal conversation reference.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Conversation identifier |

> **Type-level modeling**: The `id` field MUST be non-optional at the type level (same rule as `ChannelAccount.id`).
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
>
> **Well-known entity fields**: Entity sub-types (e.g., mention entities) define well-known fields such as `mentioned` and `text`. These MUST be top-level properties on the entity object — NOT nested inside the extension data / properties bag. In TypeScript this is achieved via index signatures or dedicated interfaces (e.g., `MentionEntity`); in Python via Pydantic fields; in .NET via typed sub-classes or `JsonElement` properties. Extension data is only for truly unknown properties.

---

## Extension Data Round-Trip

All activity types may carry additional properties beyond the typed fields. botas preserves these as extension data, so custom channel data round-trips safely. Both `customField` and `channelData` in the example below are preserved in the extension dictionary. See [Serialization Rules](#serialization-rules).

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
