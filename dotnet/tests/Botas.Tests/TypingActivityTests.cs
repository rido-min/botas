using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Botas.Tests;

public class TypingActivityTests
{
    private static BotApplication CreateBot(string appId = "bot-123")
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection([new KeyValuePair<string, string?>("AzureAd:ClientId", appId)])
            .Build();
        return new BotApplication(config, NullLogger<BotApplication>.Instance);
    }

    private static CoreActivity CreateTypingActivity()
    {
        return new CoreActivity("typing")
        {
            ServiceUrl = "https://test.service.com",
            Conversation = new Conversation { Id = "conv-123" },
            From = new ChannelAccount { Id = "user-456", Name = "Test User" },
            Recipient = new ChannelAccount { Id = "bot-123", Name = "Test Bot" }
        };
    }

    [Fact]
    public void Typing_activity_type_is_typing()
    {
        var activity = CreateTypingActivity();
        Assert.Equal("typing", activity.Type);
    }

    [Fact]
    public async Task SendTypingAsync_creates_typing_activity_with_routing_fields()
    {
        var bot = CreateBot();
        var incomingActivity = new CoreActivity("message")
        {
            ServiceUrl = "https://test.service.com",
            Conversation = new Conversation { Id = "conv-123" },
            From = new ChannelAccount { Id = "user-456", Name = "Test User" },
            Recipient = new ChannelAccount { Id = "bot-123", Name = "Test Bot" }
        };

        // Test the builder logic directly
        var typingActivity = new CoreActivityBuilder()
            .WithType("typing")
            .WithConversationReference(incomingActivity)
            .Build();

        Assert.Equal("typing", typingActivity.Type);
        Assert.Equal("https://test.service.com", typingActivity.ServiceUrl);
        Assert.Equal("conv-123", typingActivity.Conversation?.Id);
        Assert.Equal("bot-123", typingActivity.From?.Id);
        Assert.Equal("user-456", typingActivity.Recipient?.Id);
    }

    [Fact]
    public void SendTypingAsync_returns_task_of_string()
    {
        var bot = CreateBot();
        var incomingActivity = new CoreActivity("message")
        {
            ServiceUrl = "https://test.service.com",
            Conversation = new Conversation { Id = "conv-123" },
            From = new ChannelAccount { Id = "user-456" },
            Recipient = new ChannelAccount { Id = "bot-123" }
        };

        var context = new TurnContext(bot, incomingActivity);

        // Verify return type
        var task = context.SendTypingAsync();
        Assert.IsType<Task<string>>(task);
    }

    [Fact]
    public void Typing_activity_builder_creates_correct_type()
    {
        var activity = new CoreActivityBuilder()
            .WithType("typing")
            .WithServiceUrl("https://test.service.com")
            .WithConversation(new Conversation { Id = "conv-123" })
            .WithFrom(new ChannelAccount { Id = "bot-123" })
            .WithRecipient(new ChannelAccount { Id = "user-456" })
            .Build();

        Assert.Equal("typing", activity.Type);
        Assert.Equal("https://test.service.com", activity.ServiceUrl);
        Assert.Equal("conv-123", activity.Conversation?.Id);
        Assert.Equal("bot-123", activity.From?.Id);
        Assert.Equal("user-456", activity.Recipient?.Id);
    }

    [Fact]
    public void CoreActivity_builder_swaps_from_recipient_for_reply()
    {
        var incoming = new CoreActivity("message")
        {
            ServiceUrl = "https://test.service.com",
            Conversation = new Conversation { Id = "conv-123" },
            From = new ChannelAccount { Id = "user-456" },
            Recipient = new ChannelAccount { Id = "bot-123" }
        };

        var reply = new CoreActivityBuilder()
            .WithConversationReference(incoming)
            .Build();

        // From and Recipient should be swapped
        Assert.Equal("bot-123", reply.From?.Id);
        Assert.Equal("user-456", reply.Recipient?.Id);
    }
}
