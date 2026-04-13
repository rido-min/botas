---
layout: default
title: Teams Features
nav_order: 4
---

# Teams Features
{: .no_toc }

Send mentions, adaptive cards, and suggested actions using `TeamsActivity` and `TeamsActivityBuilder`.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

While `CoreActivity` handles basic Bot Framework messaging, Microsoft Teams adds rich features — mentions, adaptive cards, channel metadata, quick-reply buttons — that bots frequently use.

**`TeamsActivity`** extends `CoreActivity` with strongly-typed Teams-specific properties.
**`TeamsActivityBuilder`** provides a fluent API for constructing replies with mentions, cards, and suggested actions.

For the full specification, see [specs/teams-activity.md](https://github.com/rido-min/botas/blob/main/specs/teams-activity.md).

---

## Mentions

Mention a user in a reply by combining `withText()` (with `<at>Name</at>` markup) and `addMention()` (which creates the mention entity).

{: .important }
`addMention()` does **not** modify the activity text — you must include the `<at>Name</at>` markup yourself. This is intentional: explicit is better than magic.

### .NET

```csharp
var sender = ctx.Activity.From!;
var reply = new TeamsActivityBuilder()
    .WithText($"<at>{sender.Name}</at> said: {text}")
    .AddMention(sender)
    .Build();
await ctx.SendAsync(reply, ct);
```

### Node.js

```typescript
import { TeamsActivityBuilder } from 'botas'

const sender = ctx.activity.from
const reply = new TeamsActivityBuilder()
  .withText(`<at>${sender.name}</at> said: ${text}`)
  .addMention(sender)
  .build()
await ctx.send(reply)
```

### Python

```python
from botas import TeamsActivityBuilder

sender = ctx.activity.from_account
reply = (
    TeamsActivityBuilder()
    .with_text(f"<at>{sender.name}</at> said: {text}")
    .add_mention(sender)
    .build()
)
await ctx.send(reply)
```

---

## Adaptive Cards

Send rich interactive cards using `addAdaptiveCardAttachment()` (appends) or `withAdaptiveCardAttachment()` (replaces all attachments with one card).

Both methods accept a JSON string, parse it, and wrap it in an attachment with `contentType: "application/vnd.microsoft.card.adaptive"`.

### .NET

```csharp
var cardJson = """
{
    "type": "AdaptiveCard",
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    "version": "1.5",
    "body": [
        { "type": "TextBlock", "text": "Hello!", "size": "Large", "weight": "Bolder" }
    ]
}
""";

var reply = new TeamsActivityBuilder()
    .WithAdaptiveCardAttachment(cardJson)
    .Build();
await ctx.SendAsync(reply, ct);
```

### Node.js

```typescript
const cardJson = JSON.stringify({
  type: 'AdaptiveCard',
  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
  version: '1.5',
  body: [
    { type: 'TextBlock', text: 'Hello!', size: 'Large', weight: 'Bolder' }
  ]
})

const reply = new TeamsActivityBuilder()
  .withAdaptiveCardAttachment(cardJson)
  .build()
await ctx.send(reply)
```

### Python

```python
import json

card_json = json.dumps({
    "type": "AdaptiveCard",
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    "version": "1.5",
    "body": [
        {"type": "TextBlock", "text": "Hello!", "size": "Large", "weight": "Bolder"}
    ],
})

reply = (
    TeamsActivityBuilder()
    .with_adaptive_card_attachment(card_json)
    .build()
)
await ctx.send(reply)
```

---

## Suggested Actions

Offer quick-reply buttons to the user with `withSuggestedActions()`. Each button is a `CardAction` with a type (typically `"imBack"`), a display title, and a value sent back when clicked.

### .NET

```csharp
var reply = new TeamsActivityBuilder()
    .WithText("Pick an option:")
    .WithSuggestedActions(new SuggestedActions
    {
        Actions =
        [
            new CardAction { Type = "imBack", Title = "Option A", Value = "a" },
            new CardAction { Type = "imBack", Title = "Option B", Value = "b" },
        ]
    })
    .Build();
await ctx.SendAsync(reply, ct);
```

### Node.js

```typescript
const reply = new TeamsActivityBuilder()
  .withText('Pick an option:')
  .withSuggestedActions({
    actions: [
      { type: 'imBack', title: 'Option A', value: 'a' },
      { type: 'imBack', title: 'Option B', value: 'b' },
    ]
  })
  .build()
await ctx.send(reply)
```

### Python

```python
from botas.suggested_actions import SuggestedActions, CardAction

reply = (
    TeamsActivityBuilder()
    .with_text("Pick an option:")
    .with_suggested_actions(SuggestedActions(
        actions=[
            CardAction(type="imBack", title="Option A", value="a"),
            CardAction(type="imBack", title="Option B", value="b"),
        ]
    ))
    .build()
)
await ctx.send(reply)
```

---

## TeamsActivity — reading Teams data

Use `TeamsActivity.fromActivity()` to access Teams-specific metadata from an incoming activity:

### .NET

```csharp
var teamsActivity = TeamsActivity.FromActivity(ctx.Activity);
Console.WriteLine($"Tenant: {teamsActivity.ChannelData?.Tenant?.Id}");
Console.WriteLine($"Locale: {teamsActivity.Locale}");
```

### Node.js

```typescript
import { TeamsActivity } from 'botas'

const teamsActivity = TeamsActivity.fromActivity(ctx.activity)
console.log(`Tenant: ${teamsActivity.channelData?.tenant?.id}`)
console.log(`Locale: ${teamsActivity.locale}`)
```

### Python

```python
from botas import TeamsActivity

teams_activity = TeamsActivity.from_activity(ctx.activity)
print(f"Tenant: {teams_activity.channel_data.tenant.id}")
print(f"Locale: {teams_activity.locale}")
```

---

## TeamsChannelData

`TeamsActivity.channelData` (or `channel_data` in Python) provides typed access to Teams metadata:

| Property | Type | Description |
|----------|------|-------------|
| `tenant` | `TenantInfo` | Azure AD tenant (`id`) |
| `channel` | `ChannelInfo` | Teams channel (`id`, `name`) |
| `team` | `TeamInfo` | Teams team (`id`, `name`, `aadGroupId`) |
| `meeting` | `MeetingInfo` | Meeting context (`id`) |
| `notification` | `NotificationInfo` | Alert settings (`alert`) |

Unknown fields in `channelData` are preserved as extension data, so new Teams features won't break existing code.

---

## Running the TeamsSample

Each language has a complete sample in the repository. The sample responds to three commands:

| Command | Response |
|---------|----------|
| `cards` | Sends an Adaptive Card |
| `actions` | Sends Suggested Actions (quick-reply buttons) |
| *(anything else)* | Echoes back with an @mention of the sender |

```bash
# .NET
cd dotnet && dotnet run --project samples/TeamsSample

# Node.js
cd node && npx tsx samples/teams-sample/index.ts

# Python
cd python/samples/teams-sample && python main.py
```

---

## Next steps

- [Full TeamsActivity spec](https://github.com/rido-min/botas/blob/main/specs/teams-activity.md) — complete type definitions and design decisions
- [Middleware](middleware) — add RemoveMentionMiddleware to strip bot @mentions from incoming text
- [Language guides](languages/) — deeper coverage of each implementation
