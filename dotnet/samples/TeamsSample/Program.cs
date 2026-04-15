// TeamsSample — demonstrates TeamsActivity features:
//   • Mentions — echo back with an @mention of the sender
//   • Suggested Actions — offer quick-reply buttons
//   • Adaptive Cards — send a rich card with Action.Execute
//   • Invoke handling — respond to adaptiveCard/action

using Botas;
using FluentCards;

var app = BotApp.Create(args);

app.Use(new RemoveMentionMiddleware());

app.OnInvoke("adaptiveCard/action", async (ctx, ct) =>
{
    // Extract verb and data from the invoke payload
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
        .AddTextBlock(tb => tb
            .WithText($"Data: {valueJson}")
            .WithWrap(true))
        .AddAction(a => a
            .Execute()
            .WithTitle("Refresh")
            .WithVerb("refresh")
            .WithData("{\"action\":\"refresh\"}"))
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

app.On("message", async (ctx, ct) =>
{
    var text = ctx.Activity.Text?.Trim() ?? "";

    if (text.Equals("cards", StringComparison.OrdinalIgnoreCase))
    {
        // Send an Adaptive Card with Action.Execute using FluentCards
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
            .WithConversationReference(ctx.Activity)
            .WithAdaptiveCardAttachment(card.ToJson())
            .Build();

        await ctx.SendAsync(reply, ct);
    }
    else if (text.Equals("actions", StringComparison.OrdinalIgnoreCase))
    {
        // Send Suggested Actions
        var reply = new TeamsActivityBuilder()
            .WithConversationReference(ctx.Activity)
            .WithText("Pick an option:")
            .WithSuggestedActions(new SuggestedActions
            {
                Actions =
                [
                    new CardAction { Type = "imBack", Title = "🃏 Cards", Value = "cards" },
                    new CardAction { Type = "imBack", Title = "👋 Mention", Value = "mention" },
                    new CardAction { Type = "imBack", Title = "⚡ Actions", Value = "actions" },
                ]
            })
            .Build();

        await ctx.SendAsync(reply, ct);
    }
    else
    {
        // Default: echo back with a mention of the sender
        var sender = ctx.Activity.From!;
        var reply = new TeamsActivityBuilder()
            .WithConversationReference(ctx.Activity)
            .WithText($"<at>{sender.Name}</at> said: {text}")
            .AddMention(sender)
            .Build();

        await ctx.SendAsync(reply, ct);
    }
});

app.Run();
