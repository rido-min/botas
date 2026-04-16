---
outline: deep
---

# Teams Features

Send mentions, adaptive cards, and suggested actions using `TeamsActivity` and `TeamsActivityBuilder`.

## Overview

While `CoreActivity` handles basic Bot Framework messaging, Microsoft Teams adds rich features — mentions, adaptive cards, channel metadata, quick-reply buttons — that bots frequently use.

**`TeamsActivity`** extends `CoreActivity` with strongly-typed Teams-specific properties.
**`TeamsActivityBuilder`** provides a fluent API for constructing replies with mentions, cards, and suggested actions.

For the full specification, see [specs/teams-activity.md](https://github.com/rido-min/botas/blob/main/specs/teams-activity.md).

---

## Mentions

Mention a user in a reply by combining `withText()` (with `<at>Name</at>` markup) and `addMention()` (which creates the mention entity).

::: warning
`addMention()` does **not** modify the activity text — you must include the `<at>Name</at>` markup yourself. This is intentional: explicit is better than magic.
:::

::: code-group
```csharp [.NET]
var sender = ctx.Activity.From!;
var reply = new TeamsActivityBuilder()
    .WithText($"<at>{sender.Name}</at> said: {text}")
    .AddMention(sender)
    .Build();
await ctx.SendAsync(reply, ct);
```

```typescript [Node.js]
import { TeamsActivityBuilder } from 'botas-core'

const sender = ctx.activity.from
const reply = new TeamsActivityBuilder()
  .withText(`<at>${sender.name}</at> said: ${text}`)
  .addMention(sender)
  .build()
await ctx.send(reply)
```

```python [Python]
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
:::

---

## Adaptive Cards

Send rich interactive cards using `addAdaptiveCardAttachment()` (appends) or `withAdaptiveCardAttachment()` (replaces all attachments with one card).

Both methods accept a JSON string, parse it, and wrap it in an attachment with `contentType: "application/vnd.microsoft.card.adaptive"`.

We recommend using [FluentCards](https://github.com/rido-min/FluentCards) to build Adaptive Cards with a fluent, strongly-typed API instead of raw JSON. FluentCards is available for all three languages: NuGet [`FluentCards`](https://www.nuget.org/packages/FluentCards), npm [`fluent-cards`](https://www.npmjs.com/package/fluent-cards), and PyPI [`fluent-cards`](https://pypi.org/project/fluent-cards/).

::: code-group
```csharp [.NET]
using FluentCards;

var card = AdaptiveCardBuilder.Create()
    .WithVersion(AdaptiveCardVersion.V1_5)
    .AddTextBlock(tb => tb
        .WithText("Hello from TeamsSample!")
        .WithSize(TextSize.Large)
        .WithWeight(TextWeight.Bolder))
    .AddTextBlock(tb => tb
        .WithText("Click the button below to trigger an invoke action.")
        .WithWrap(true))
    .AddInputText(it => it
        .WithId("userInput")
        .WithPlaceholder("Type something here..."))
    .AddAction(a => a
        .Execute()
        .WithTitle("Submit")
        .WithVerb("submitAction")
        .WithData("{\"action\":\"submit\"}"))
    .Build();

var reply = new TeamsActivityBuilder()
    .WithAdaptiveCardAttachment(card.ToJson())
    .Build();
await ctx.SendAsync(reply, ct);
```

```typescript [Node.js]
import { AdaptiveCardBuilder, TextSize, TextWeight, toJson } from 'fluent-cards'

const card = AdaptiveCardBuilder.create()
  .withVersion('1.5')
  .addTextBlock(tb => tb
    .withText('Hello from TeamsSample!')
    .withSize(TextSize.Large)
    .withWeight(TextWeight.Bolder))
  .addTextBlock(tb => tb
    .withText('Click the button below to trigger an invoke action.')
    .withWrap(true))
  .addInputText(it => it
    .withId('userInput')
    .withPlaceholder('Type something here...'))
  .addAction(a => a
    .execute()
    .withTitle('Submit')
    .withVerb('submitAction')
    .withData({ action: 'submit' }))
  .build()

const reply = new TeamsActivityBuilder()
  .withAdaptiveCardAttachment(toJson(card))
  .build()
await ctx.send(reply)
```

```python [Python]
from fluent_cards import AdaptiveCardBuilder, TextSize, TextWeight, to_json

card = (
    AdaptiveCardBuilder.create()
    .with_version("1.5")
    .add_text_block(
        lambda tb: tb.with_text("Hello from TeamsSample!")
        .with_size(TextSize.Large)
        .with_weight(TextWeight.Bolder)
    )
    .add_text_block(
        lambda tb: tb.with_text("Click the button below to trigger an invoke action.")
        .with_wrap(True)
    )
    .add_input_text(lambda it: it.with_id("userInput").with_placeholder("Type something here..."))
    .add_action(
        lambda a: a.execute().with_title("Submit").with_verb("submitAction").with_data({"action": "submit"})
    )
    .build()
)

reply = (
    TeamsActivityBuilder()
    .with_adaptive_card_attachment(to_json(card))
    .build()
)
await ctx.send(reply)
```
:::

---

## Invoke Handling (Action.Execute)

When a user clicks an `Action.Execute` button on an Adaptive Card, Teams sends an **invoke** activity with `name: "adaptiveCard/action"`. The invoke payload contains the `verb` and `data` you specified when building the card.

Register an invoke handler to process the action and return a response card:

::: code-group
```csharp [.NET]
using FluentCards;

app.OnInvoke("adaptiveCard/action", async (ctx, ct) =>
{
    var valueJson = ctx.Activity.Value?.ToString() ?? "{}";
    var valueDoc = System.Text.Json.JsonDocument.Parse(valueJson);
    var verb = valueDoc.RootElement.TryGetProperty("action", out var actionProp)
        ? actionProp.TryGetProperty("verb", out var verbProp) ? verbProp.GetString() ?? "unknown" : "unknown"
        : "unknown";

    var responseCard = AdaptiveCardBuilder.Create()
        .WithVersion(AdaptiveCardVersion.V1_5)
        .AddTextBlock(tb => tb
            .WithText("✅ Action received!")
            .WithSize(TextSize.Large)
            .WithWeight(TextWeight.Bolder)
            .WithColor(TextColor.Good))
        .AddTextBlock(tb => tb
            .WithText($"Verb: {verb}")
            .WithWrap(true))
        .Build();

    return new InvokeResponse
    {
        Status = 200,
        Body = new
        {
            statusCode = 200,
            type = "application/vnd.microsoft.card.adaptive",
            value = responseCard.ToJsonElement()
        }
    };
});
```

```typescript [Node.js]
import { AdaptiveCardBuilder, TextSize, TextWeight, TextColor, toJson, toObject } from 'fluent-cards'

app.onInvoke('adaptiveCard/action', async (ctx) => {
  const value = ctx.activity.value as any
  const verb = value?.action?.verb ?? 'unknown'

  const card = AdaptiveCardBuilder.create()
    .withVersion('1.5')
    .addTextBlock(tb => tb
      .withText('✅ Action received!')
      .withSize(TextSize.Large)
      .withWeight(TextWeight.Bolder)
      .withColor(TextColor.Good))
    .addTextBlock(tb => tb
      .withText(`Verb: ${verb}`)
      .withWrap(true))
    .build()

  return {
    status: 200,
    body: {
      statusCode: 200,
      type: 'application/vnd.microsoft.card.adaptive',
      value: toObject(card)
    }
  }
})
```

```python [Python]
from fluent_cards import AdaptiveCardBuilder, TextSize, TextWeight, TextColor, to_dict

@app.on_invoke("adaptiveCard/action")
async def on_card_action(ctx):
    value = ctx.activity.value or {}
    action_info = value.get("action", {})
    verb = action_info.get("verb", "unknown")

    response_card = (
        AdaptiveCardBuilder.create()
        .with_version("1.5")
        .add_text_block(
            lambda tb: tb.with_text("✅ Action received!")
            .with_size(TextSize.Large)
            .with_weight(TextWeight.Bolder)
            .with_color(TextColor.Good)
        )
        .add_text_block(lambda tb: tb.with_text(f"Verb: {verb}").with_wrap(True))
        .build()
    )

    return InvokeResponse(
        status=200,
        body={
            "statusCode": 200,
            "type": "application/vnd.microsoft.card.adaptive",
            "value": to_dict(response_card),
        },
    )
```
:::

::: tip Invoke flow
```
Card (Action.Execute with verb + data)
  → User clicks button in Teams
    → Teams sends invoke activity (name="adaptiveCard/action")
      → Bot invoke handler reads verb + data from activity.value.action
        → Handler returns an Adaptive Card response
```
:::

---

## Suggested Actions

Offer quick-reply buttons to the user with `withSuggestedActions()`. Each button is a `CardAction` with a type (typically `"imBack"`), a display title, and a value sent back when clicked.

::: code-group
```csharp [.NET]
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

```typescript [Node.js]
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

```python [Python]
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
:::

---

## TeamsActivity — reading Teams data

Use `TeamsActivity.fromActivity()` to access Teams-specific metadata from an incoming activity:

::: code-group
```csharp [.NET]
var teamsActivity = TeamsActivity.FromActivity(ctx.Activity);
Console.WriteLine($"Tenant: {teamsActivity.ChannelData?.Tenant?.Id}");
Console.WriteLine($"Locale: {teamsActivity.Locale}");
```

```typescript [Node.js]
import { TeamsActivity } from 'botas-core'

const teamsActivity = TeamsActivity.fromActivity(ctx.activity)
console.log(`Tenant: ${teamsActivity.channelData?.tenant?.id}`)
console.log(`Locale: ${teamsActivity.locale}`)
```

```python [Python]
from botas import TeamsActivity

teams_activity = TeamsActivity.from_activity(ctx.activity)
print(f"Tenant: {teams_activity.channel_data.tenant.id}")
print(f"Locale: {teams_activity.locale}")
```
:::

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

Each language has a complete sample in the repository using [FluentCards](https://github.com/rido-min/FluentCards) for Adaptive Card construction. The sample responds to three commands:

| Command | Response |
|---------|----------|
| `cards` | Sends an Adaptive Card with an `Action.Execute` button |
| `actions` | Sends Suggested Actions (quick-reply buttons) |
| *(anything else)* | Echoes back with an @mention of the sender |

When you click the **Submit** button on the Adaptive Card, Teams sends an invoke activity. The bot processes the verb and data, then responds with a confirmation card — demonstrating the full card → invoke → response round-trip.

::: code-group
```bash [.NET]
cd dotnet && dotnet run --project samples/TeamsSample
```

```bash [Node.js]
cd node && npx tsx samples/teams-sample/index.ts
```

```bash [Python]
cd python/samples/teams-sample && python main.py
```
:::

---

## Typing Indicators

Show the user that your bot is working on a reply. Typing activities are part of the core Bot Framework protocol (not Teams-specific), but they are especially useful in Teams where users expect real-time feedback.

### Sending a typing indicator

Use `sendTyping()` / `SendTypingAsync()` / `send_typing()` on `TurnContext` when processing takes a few seconds:

::: code-group
```csharp [.NET]
app.On("message", async (ctx, ct) =>
{
    await ctx.SendTypingAsync(ct);
    await Task.Delay(3000, ct);         // simulate long-running work
    await ctx.SendAsync("Processing complete!", ct);
});
```

```typescript [Node.js]
app.on('message', async (ctx) => {
  await ctx.sendTyping()
  await new Promise(resolve => setTimeout(resolve, 3000))
  await ctx.send('Processing complete!')
})
```

```python [Python]
@app.on("message")
async def on_message(ctx):
    await ctx.send_typing()
    await asyncio.sleep(3)              # simulate long-running work
    await ctx.send("Processing complete!")
```
:::

::: tip
- Reserve typing indicators for operations that genuinely take 1–3+ seconds.
- You can send typing multiple times in a single turn if the operation has distinct phases.
:::

---

## Next steps

- [Full TeamsActivity spec](https://github.com/rido-min/botas/blob/main/specs/teams-activity.md) — complete type definitions and design decisions
- [Middleware](middleware) — add RemoveMentionMiddleware to strip bot @mentions from incoming text
- [Language guides](languages/) — deeper coverage of each implementation
