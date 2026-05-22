using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using Botas;
using Botas.State;
using FluentCards;

var version = BotApplication.Version;
var platform = RuntimeInformation.FrameworkDescription;

var app = BotApp.Create(args);

// Enable TurnState with MemoryStorage
app.UseState(new MemoryStorage());

app.On("message", async (context, ct) =>
{
    var text = (context.Activity.Text ?? "").Trim();
    
    // Counter command - must be at the top
    if (text.Equals("counter", StringComparison.OrdinalIgnoreCase))
    {
        var count = context.State?.User.Get<int>("count") ?? 0;
        count++;
        context.State?.User.Set("count", count);
        await context.SendAsync($"Count: {count}", ct);
        return;
    }
    
    // Reset command
    if (text.Equals("reset", StringComparison.OrdinalIgnoreCase))
    {
        context.State?.User.Delete("count");
        await context.SendAsync("Counter reset", ct);
        return;
    }
    
    if (text.Equals("card", StringComparison.OrdinalIgnoreCase))
    {
        var card = AdaptiveCardBuilder.Create()
            .WithVersion(AdaptiveCardVersion.V1_5)
            .AddTextBlock(tb => tb.WithText("Invoke Test Card").WithWeight(TextWeight.Bolder))
            .AddTextBlock(tb => tb.WithText("Click the button to trigger an invoke."))
            .AddAction(a => a
                .Execute()
                .WithTitle("Submit")
                .WithVerb("test")
                .WithData("{\"source\":\"e2e\"}"))
            .Build();

        var reply = new CoreActivity("message")
        {
            Attachments = new JsonArray
            {
                new JsonObject
                {
                    ["contentType"] = "application/vnd.microsoft.card.adaptive",
                    ["content"] = card.ToJsonNode()
                }
            }
        };
        await context.SendAsync(reply, ct);
    }
    else if (text.Equals("submit", StringComparison.OrdinalIgnoreCase))
    {
        // Action.Submit card — clicking produces a message activity with flat activity.value
        var card = AdaptiveCardBuilder.Create()
            .WithVersion(AdaptiveCardVersion.V1_5)
            .AddTextBlock(tb => tb.WithText("Action.Submit Test Card").WithWeight(TextWeight.Bolder))
            .AddTextBlock(tb => tb.WithText("Click the button to send a message with value."))
            .AddAction(a => a
                .Submit()
                .WithTitle("Send")
                .WithData("{\"source\":\"e2e\",\"action\":\"submit\"}"))
            .Build();

        var reply = new CoreActivity("message")
        {
            Attachments = new JsonArray
            {
                new JsonObject
                {
                    ["contentType"] = "application/vnd.microsoft.card.adaptive",
                    ["content"] = card.ToJsonNode()
                }
            }
        };
        await context.SendAsync(reply, ct);
    }
    else if (text.StartsWith("mention", StringComparison.OrdinalIgnoreCase))
    {
        var sender = context.Activity.From!;
        var displayName = sender.Name ?? sender.Id ?? "user";
        var reply = new TeamsActivityBuilder()
            .WithConversationReference(context.Activity)
            .WithText($"<at>{displayName}</at> said: {context.Activity.Text}")
            .AddMention(sender)
            .Build();
        await context.SendAsync(reply, ct);
    }
    else if (context.Activity.Value is not null && string.IsNullOrWhiteSpace(text))
    {
        // Action.Submit produces a message with activity.value (no text)
        await context.SendAsync($"Submit received: {JsonSerializer.Serialize(context.Activity.Value)}", ct);
    }
    else
    {
        await context.SendAsync($"Echo: {context.Activity.Text} [botas-dotnet v{version} | {platform}]", ct);
    }
});

app.OnInvoke("adaptiveCard/action", async (context, ct) =>
{
    var responseCard = new JsonObject
    {
        ["type"] = "AdaptiveCard",
        ["version"] = "1.5",
        ["body"] = new JsonArray
        {
            new JsonObject { ["type"] = "TextBlock", ["text"] = "✅ Invoke received!", ["weight"] = "bolder" }
        }
    };
    return new InvokeResponse
    {
        Status = 200,
        Body = new
        {
            statusCode = 200,
            type = "application/vnd.microsoft.card.adaptive",
            value = responseCard
        }
    };
});

app.OnInvoke("test/echo", async (context, ct) =>
{
    return new InvokeResponse { Status = 200, Body = context.Activity.Value };
});

app.Run();
