using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Botas.Tests;

public class RemoveMentionMiddlewareTests
{
    private static BotApplication CreateBot(string appId = "bot-123")
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection([new KeyValuePair<string, string?>("AzureAd:ClientId", appId)])
            .Build();
        return new BotApplication(config, NullLogger<BotApplication>.Instance);
    }

    private static CoreActivity CreateActivityWithMention(string botId, string botName, string text)
    {
        var mentionEntity = new JsonObject
        {
            ["type"] = "mention",
            ["mentioned"] = new JsonObject
            {
                ["id"] = botId,
                ["name"] = botName
            },
            ["text"] = $"<at>{botName}</at>"
        };

        return new CoreActivity("message")
        {
            Text = text,
            Recipient = new ChannelAccount { Id = botId, Name = botName },
            Entities = new JsonArray(mentionEntity)
        };
    }

    [Fact]
    public void Strips_bot_mention_from_activity_text()
    {
        var bot = CreateBot("bot-123");
        var activity = CreateActivityWithMention("bot-123", "TestBot", "<at>TestBot</at> hello there");
        var context = new TurnContext(bot, activity);

        RemoveMentionMiddleware.RemoveRecipientMention(context);

        Assert.Equal("hello there", activity.Text);
    }

    [Fact]
    public void Does_not_strip_mention_for_other_user()
    {
        var bot = CreateBot("bot-123");

        var otherMention = new JsonObject
        {
            ["type"] = "mention",
            ["mentioned"] = new JsonObject
            {
                ["id"] = "user-456",
                ["name"] = "OtherUser"
            },
            ["text"] = "<at>OtherUser</at>"
        };

        var activity = new CoreActivity("message")
        {
            Text = "<at>OtherUser</at> hello",
            Recipient = new ChannelAccount { Id = "bot-123", Name = "TestBot" },
            Entities = new JsonArray(otherMention)
        };

        var context = new TurnContext(bot, activity);
        RemoveMentionMiddleware.RemoveRecipientMention(context);

        Assert.Equal("<at>OtherUser</at> hello", activity.Text);
    }

    [Fact]
    public void Handles_null_entities()
    {
        var bot = CreateBot("bot-123");
        var activity = new CoreActivity("message") { Text = "hello" };
        var context = new TurnContext(bot, activity);

        RemoveMentionMiddleware.RemoveRecipientMention(context);

        Assert.Equal("hello", activity.Text);
    }

    [Fact]
    public void Handles_null_text()
    {
        var bot = CreateBot("bot-123");
        var activity = CreateActivityWithMention("bot-123", "TestBot", "dummy");
        activity.Text = null;
        var context = new TurnContext(bot, activity);

        RemoveMentionMiddleware.RemoveRecipientMention(context);

        Assert.Null(activity.Text);
    }

    [Fact]
    public void Trims_whitespace_after_removal()
    {
        var bot = CreateBot("bot-123");
        var activity = CreateActivityWithMention("bot-123", "TestBot", "  <at>TestBot</at>   hello  ");
        var context = new TurnContext(bot, activity);

        RemoveMentionMiddleware.RemoveRecipientMention(context);

        Assert.Equal("hello", activity.Text);
    }

    [Fact]
    public void Strips_mention_case_insensitive()
    {
        var bot = CreateBot("BOT-123");
        var activity = CreateActivityWithMention("bot-123", "TestBot", "<at>TestBot</at> hi");
        var context = new TurnContext(bot, activity);

        RemoveMentionMiddleware.RemoveRecipientMention(context);

        Assert.Equal("hi", activity.Text);
    }

    [Fact]
    public async Task Middleware_calls_next()
    {
        var middleware = new RemoveMentionMiddleware();
        var bot = CreateBot("bot-123");
        var activity = CreateActivityWithMention("bot-123", "TestBot", "<at>TestBot</at> hello");
        var context = new TurnContext(bot, activity);

        bool nextCalled = false;
        await middleware.OnTurnAsync(context, (ct) =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        Assert.True(nextCalled);
        Assert.Equal("hello", activity.Text);
    }

    [Fact]
    public void Handles_multiple_entities_strips_only_bot()
    {
        var bot = CreateBot("bot-123");

        var botMention = new JsonObject
        {
            ["type"] = "mention",
            ["mentioned"] = new JsonObject { ["id"] = "bot-123", ["name"] = "TestBot" },
            ["text"] = "<at>TestBot</at>"
        };
        var userMention = new JsonObject
        {
            ["type"] = "mention",
            ["mentioned"] = new JsonObject { ["id"] = "user-456", ["name"] = "Alice" },
            ["text"] = "<at>Alice</at>"
        };

        var activity = new CoreActivity("message")
        {
            Text = "<at>TestBot</at> hey <at>Alice</at>",
            Recipient = new ChannelAccount { Id = "bot-123", Name = "TestBot" },
            Entities = new JsonArray(botMention, userMention)
        };

        var context = new TurnContext(bot, activity);
        RemoveMentionMiddleware.RemoveRecipientMention(context);

        Assert.Equal("hey <at>Alice</at>", activity.Text);
    }

    [Fact]
    public void Falls_back_to_recipient_id_when_no_app_id()
    {
        var bot = new BotApplication(); // no config, AppId is null
        var activity = CreateActivityWithMention("recipient-id", "TestBot", "<at>TestBot</at> hello");
        var context = new TurnContext(bot, activity);

        RemoveMentionMiddleware.RemoveRecipientMention(context);

        Assert.Equal("hello", activity.Text);
    }

    [Fact]
    public async Task Middleware_integrates_with_pipeline()
    {
        var bot = CreateBot("bot-123");
        bot.Use(new RemoveMentionMiddleware());

        string? receivedText = null;
        bot.OnActivity = (ctx, ct) =>
        {
            receivedText = ctx.Activity.Text;
            return Task.CompletedTask;
        };

        var activity = CreateActivityWithMention("bot-123", "TestBot", "<at>TestBot</at> pipeline test");
        var context = new TurnContext(bot, activity);

        await bot.MiddleWare.RunPipeline(context, bot.OnActivity, 0, CancellationToken.None);

        Assert.Equal("pipeline test", receivedText);
    }
}
