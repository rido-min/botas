# Activity Schema Spec

**Purpose**: Define the JSON payload structure for activities exchanged between bots and the Bot Framework Service.
**Status**: Draft

> **Note**: Outbound activities are typically constructed using the fluent `CoreActivityBuilder`. See the [Bot Spec — CoreActivityBuilder](./README.md#coreactivitybuilder) for the API.

---

## Overview

All communication between a bot and the Bot Framework Service uses **Activity** JSON objects. This document defines the schema and serialization rules.

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

```json
{
  "type": "message",
  "id": "activity-id",
  "serviceUrl": "https://smba.trafficmanager.net/...",
  "channelId": "msteams",
  "text": "Hello bot!",
  "from": { ... },
  "recipient": { ... },
  "conversation": { ... },
  "entities": [ ... ],
  "attachments": [ ... ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Activity type (e.g., `"message"`) |
| `id` | `string` | No | Unique activity identifier (assigned by the channel) |
| `serviceUrl` | `string` | Yes | Callback URL for this conversation's channel |
| `channelId` | `string` | No | Channel identifier (e.g., `"msteams"`, `"webchat"`) |
| `text` | `string` | No | Message text content |
| `from` | [ChannelAccount](#channelaccount) | Yes | Sender information |
| `recipient` | [ChannelAccount](#channelaccount) | Yes | Recipient information |
| `conversation` | [Conversation](#conversation) | Yes | Conversation context |
| `entities` | `array` | No | Mentions, card actions, and other entities |
| `attachments` | `array` | No | File or card attachments |
| *(any other)* | *any* | No | Preserved as extension data |

---

## ChannelAccount

Represents a user or bot identity.

```json
{
  "id": "29:1abc...",
  "name": "User Name",
  "aadObjectId": "guid-here",
  "role": "user"
}
```

### Fields

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

```json
{
  "id": "conversation-id"
}
```

### Fields

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

## References

- [Protocol Spec](./protocol.md) — HTTP contract for sending/receiving activities
- [Bot Framework Activity Schema](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#activity-object)
