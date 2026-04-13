using System.Text.Json;

namespace Botas.Tests;

public class TeamsActivityBuilderTests
{
    private readonly CoreActivity _incoming = new()
    {
        Type = "message",
        Text = "hello",
        ServiceUrl = "http://service.url",
        From = new ChannelAccount { Id = "user1", Name = "User One" },
        Recipient = new ChannelAccount { Id = "bot1", Name = "Bot One" },
        Conversation = new Conversation { Id = "conv1" }
    };

    [Fact]
    public void Build_ReturnsTeamsActivity()
    {
        var result = new TeamsActivityBuilder()
            .WithConversationReference(_incoming)
            .WithText("reply")
            .Build();
        Assert.IsType<TeamsActivity>(result);
        Assert.Equal("message", result.Type);
        Assert.Equal("reply", result.Text);
    }

    [Fact]
    public void WithConversationReference_SwapsFromRecipient()
    {
        var result = new TeamsActivityBuilder()
            .WithConversationReference(_incoming)
            .Build();
        Assert.Equal("bot1", result.From?.Id);
        Assert.Equal("user1", result.Recipient?.Id);
        Assert.Equal("http://service.url", result.ServiceUrl);
        Assert.Equal("conv1", result.Conversation?.Id);
    }

    [Fact]
    public void WithChannelData_SetsChannelData()
    {
        var channelData = new TeamsChannelData
        {
            Tenant = new TenantInfo { Id = "tenant-1" }
        };
        var result = new TeamsActivityBuilder()
            .WithChannelData(channelData)
            .Build();
        Assert.NotNull(result.ChannelData);
        Assert.Equal("tenant-1", result.ChannelData!.Tenant?.Id);
    }

    [Fact]
    public void WithSuggestedActions_SetsSuggestedActions()
    {
        var actions = new SuggestedActions
        {
            Actions = [new CardAction { Type = "imBack", Title = "Yes", Value = "yes" }]
        };
        var result = new TeamsActivityBuilder()
            .WithSuggestedActions(actions)
            .Build();
        Assert.NotNull(result.SuggestedActions);
        Assert.Single(result.SuggestedActions!.Actions);
    }

    [Fact]
    public void AddMention_CreatesEntity()
    {
        var account = new ChannelAccount { Id = "user1", Name = "User One" };
        var result = new TeamsActivityBuilder()
            .WithText("Hello <at>User One</at>!")
            .AddMention(account)
            .Build();
        Assert.NotNull(result.Entities);
        Assert.Single(result.Entities!);
        var entity = result.Entities[0];
        Assert.NotNull(entity);
        Assert.Equal("mention", entity!["type"]?.ToString());
        Assert.Equal("<at>User One</at>", entity["text"]?.ToString());
    }

    [Fact]
    public void AddMention_WithCustomText()
    {
        var account = new ChannelAccount { Id = "user1", Name = "User One" };
        var result = new TeamsActivityBuilder()
            .AddMention(account, "<at>Custom</at>")
            .Build();
        Assert.NotNull(result.Entities);
        var entity = result.Entities![0];
        Assert.Equal("<at>Custom</at>", entity!["text"]?.ToString());
    }

    [Fact]
    public void AddMention_ThrowsOnNullAccount()
    {
        Assert.Throws<ArgumentNullException>(() =>
            new TeamsActivityBuilder().AddMention(null!));
    }

    [Fact]
    public void AddAdaptiveCardAttachment_ParsesJson()
    {
        string cardJson = """{"type":"AdaptiveCard","body":[]}""";
        var result = new TeamsActivityBuilder()
            .AddAdaptiveCardAttachment(cardJson)
            .Build();
        Assert.NotNull(result.Attachments);
        Assert.Single(result.Attachments!);
        var att = result.Attachments[0];
        Assert.Equal("application/vnd.microsoft.card.adaptive", att!["contentType"]?.ToString());
    }

    [Fact]
    public void WithAdaptiveCardAttachment_ReplacesSingle()
    {
        string cardJson = """{"type":"AdaptiveCard","body":[]}""";
        var result = new TeamsActivityBuilder()
            .WithAdaptiveCardAttachment(cardJson)
            .Build();
        Assert.NotNull(result.Attachments);
        Assert.Single(result.Attachments!);
    }

    [Fact]
    public void AddAdaptiveCardAttachment_ThrowsOnInvalidJson()
    {
        Assert.Throws<JsonException>(() =>
            new TeamsActivityBuilder().AddAdaptiveCardAttachment("not json"));
    }

    [Fact]
    public void FluentChaining_AllMethods()
    {
        var result = new TeamsActivityBuilder()
            .WithType("message")
            .WithServiceUrl("http://svc")
            .WithConversation(new Conversation { Id = "c1" })
            .WithFrom(new ChannelAccount { Id = "f1" })
            .WithRecipient(new ChannelAccount { Id = "r1" })
            .WithText("test")
            .WithChannelData(new TeamsChannelData())
            .WithSuggestedActions(new SuggestedActions { Actions = [] })
            .Build();

        Assert.Equal("message", result.Type);
        Assert.Equal("http://svc", result.ServiceUrl);
        Assert.Equal("c1", result.Conversation?.Id);
        Assert.Equal("f1", result.From?.Id);
        Assert.Equal("r1", result.Recipient?.Id);
        Assert.Equal("test", result.Text);
        Assert.NotNull(result.ChannelData);
        Assert.NotNull(result.SuggestedActions);
    }
}
