using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using Botas;

var version = BotApplication.Version;
var platform = RuntimeInformation.FrameworkDescription;

var app = BotApp.Create(args);

app.On("message", async (context, ct) =>
{
    var text = (context.Activity.Text ?? "").Trim();
    if (text.Equals("card", StringComparison.OrdinalIgnoreCase))
    {
        var card = new JsonObject
        {
            ["type"] = "AdaptiveCard",
            ["version"] = "1.5",
            ["body"] = new JsonArray
            {
                new JsonObject { ["type"] = "TextBlock", ["text"] = "Invoke Test Card", ["weight"] = "bolder" },
                new JsonObject { ["type"] = "TextBlock", ["text"] = "Click the button to trigger an invoke." }
            },
            ["actions"] = new JsonArray
            {
                new JsonObject
                {
                    ["type"] = "Action.Execute",
                    ["title"] = "Submit",
                    ["verb"] = "test",
                    ["data"] = new JsonObject { ["source"] = "e2e" }
                }
            }
        };
        var reply = new CoreActivity("message")
        {
            Attachments = new JsonArray
            {
                new JsonObject
                {
                    ["contentType"] = "application/vnd.microsoft.card.adaptive",
                    ["content"] = card
                }
            }
        };
        await context.SendAsync(reply, ct);
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
