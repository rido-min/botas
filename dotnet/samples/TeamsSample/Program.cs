// TeamsSample — demonstrates TeamsActivity features:
//   • Mentions — echo back with an @mention of the sender
//   • Suggested Actions — offer quick-reply buttons
//   • Adaptive Cards — send a rich card with the user's message

using Botas;

var app = BotApp.Create(args);

app.Use(new RemoveMentionMiddleware());

app.On("message", async (ctx, ct) =>
{
    var text = ctx.Activity.Text?.Trim() ?? "";

    if (text.Equals("cards", StringComparison.OrdinalIgnoreCase))
    {
        // Send an Adaptive Card
        var cardJson = """
        {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.5",
            "body": [
                {
                    "type": "TextBlock",
                    "text": "Hello from TeamsSample!",
                    "size": "Large",
                    "weight": "Bolder"
                },
                {
                    "type": "TextBlock",
                    "text": "This is an Adaptive Card sent by the bot.",
                    "wrap": true
                }
            ]
        }
        """;

        var reply = new TeamsActivityBuilder()
            .WithConversationReference(ctx.Activity)
            .WithAdaptiveCardAttachment(cardJson)
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
