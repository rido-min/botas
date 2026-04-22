// TeamsSample — demonstrates TeamsActivity features:
//   • conversationUpdate — welcome new members
//   • messageReaction — acknowledge reactions
//   • typing — log typing indicators
//   • installationUpdate — greet on install
//   • Mentions — echo back with an @mention of the sender
//   • Suggested Actions — offer quick-reply buttons
//   • Adaptive Cards — send a rich card with Action.Execute
//   • Invoke handling — respond to adaptiveCard/action

using System.Text.Json;
using Botas;
using FluentCards;

var app = BotApp.Create(args);

app.Use(new RemoveMentionMiddleware());

// --- conversationUpdate: welcome new members ---
app.On("conversationUpdate", async (ctx, ct) =>
{
    if (ctx.Activity.Properties.TryGetValue("membersAdded", out var membersObj)
        && membersObj is JsonElement membersEl
        && membersEl.ValueKind == JsonValueKind.Array)
    {
        foreach (var member in membersEl.EnumerateArray())
        {
            var memberId = member.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
            var memberName = member.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : "there";
            if (memberId != ctx.Activity.Recipient?.Id)
            {
                var welcome = new TeamsActivityBuilder()
                    .WithConversationReference(ctx.Activity)
                    .WithText($"Welcome to the team, {memberName}! 👋")
                    .Build();
                await ctx.SendAsync(welcome, ct);
            }
        }
    }
});

// --- messageReaction: acknowledge reactions ---
app.On("messageReaction", async (ctx, ct) =>
{
    if (ctx.Activity.Properties.TryGetValue("reactionsAdded", out var reactionsObj)
        && reactionsObj is JsonElement reactionsEl
        && reactionsEl.ValueKind == JsonValueKind.Array)
    {
        foreach (var reaction in reactionsEl.EnumerateArray())
        {
            var reactionType = reaction.TryGetProperty("type", out var typeProp) ? typeProp.GetString() : "unknown";
            var reply = new TeamsActivityBuilder()
                .WithConversationReference(ctx.Activity)
                .WithText($"Thanks for the {reactionType} reaction! 👍")
                .Build();
            await ctx.SendAsync(reply, ct);
        }
    }
});

// --- typing: log typing indicators ---
app.On("typing", (ctx, ct) =>
{
    Console.WriteLine($"User {ctx.Activity.From?.Name} is typing...");
    return Task.CompletedTask;
});

// --- installationUpdate: greet on install ---
app.On("installationUpdate", async (ctx, ct) =>
{
    var action = ctx.Activity.Properties.TryGetValue("action", out var actionObj)
        && actionObj is JsonElement actionEl
        && actionEl.ValueKind == JsonValueKind.String
            ? actionEl.GetString() ?? "unknown"
            : "unknown";
    Console.WriteLine($"Installation update: {action}");
    if (action == "add")
    {
        var reply = new TeamsActivityBuilder()
            .WithConversationReference(ctx.Activity)
            .WithText("Thanks for installing me! Type 'cards' to see what I can do. 🚀")
            .Build();
        await ctx.SendAsync(reply, ct);
    }
});

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
            .WithAdaptiveCardAttachment(card.ToJsonElement())
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
