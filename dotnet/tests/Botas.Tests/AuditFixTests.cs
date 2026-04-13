using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Botas.Tests;

/// <summary>
/// Tests for medium/low audit fixes (#75).
/// </summary>
public class ActivityValidationTests
{
    private static (BotApplication bot, HttpContext httpCtx) CreateTestBot(string activityJson)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new[] { new KeyValuePair<string, string?>("AzureAd:ClientId", "test-id") })
            .Build();
        var bot = new BotApplication(config, NullLogger<BotApplication>.Instance);
        bot.On("message", (ctx, ct) => Task.CompletedTask);

        var services = new ServiceCollection();
        services.AddKeyedSingleton<ConversationClient>("AzureAd",
            new ConversationClient(new HttpClient(), NullLogger<ConversationClient>.Instance));
        var sp = services.BuildServiceProvider();

        var httpCtx = new DefaultHttpContext { RequestServices = sp };
        httpCtx.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(activityJson));
        httpCtx.Request.ContentType = "application/json";

        return (bot, httpCtx);
    }

    [Fact]
    public async Task ProcessAsync_RejectsActivity_WithMissingType()
    {
        var json = """{"type":"","serviceUrl":"https://example.com","conversation":{"id":"c1"}}""";
        var (bot, ctx) = CreateTestBot(json);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => bot.ProcessAsync(ctx));
        Assert.Contains("Type", ex.Message);
    }

    [Fact]
    public async Task ProcessAsync_RejectsActivity_WithNullConversation()
    {
        var json = """{"type":"message","serviceUrl":"https://example.com"}""";
        var (bot, ctx) = CreateTestBot(json);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => bot.ProcessAsync(ctx));
        Assert.Contains("Conversation.Id", ex.Message);
    }

    [Fact]
    public async Task ProcessAsync_RejectsActivity_WithEmptyConversationId()
    {
        var json = """{"type":"message","serviceUrl":"https://example.com","conversation":{"id":""}}""";
        var (bot, ctx) = CreateTestBot(json);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => bot.ProcessAsync(ctx));
        Assert.Contains("Conversation.Id", ex.Message);
    }

    [Fact]
    public async Task ProcessAsync_RejectsActivity_WithMissingServiceUrl()
    {
        var json = """{"type":"message","conversation":{"id":"c1"}}""";
        var (bot, ctx) = CreateTestBot(json);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => bot.ProcessAsync(ctx));
        Assert.Contains("ServiceUrl", ex.Message);
    }

    [Fact]
    public async Task ProcessAsync_AcceptsValidActivity()
    {
        var json = """{"type":"message","serviceUrl":"https://example.com","conversation":{"id":"c1"},"text":"hello"}""";
        var (bot, ctx) = CreateTestBot(json);

        var result = await bot.ProcessAsync(ctx);
        Assert.Equal("message", result.Type);
    }
}

public class CancellationPropagationTests
{
    [Fact]
    public async Task ProcessAsync_PropagatesOperationCanceledException()
    {
        var json = """{"type":"message","serviceUrl":"https://example.com","conversation":{"id":"c1"}}""";
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new[] { new KeyValuePair<string, string?>("AzureAd:ClientId", "test-id") })
            .Build();
        var bot = new BotApplication(config, NullLogger<BotApplication>.Instance);
        bot.On("message", (ctx, ct) => throw new OperationCanceledException());

        var services = new ServiceCollection();
        services.AddKeyedSingleton<ConversationClient>("AzureAd",
            new ConversationClient(new HttpClient(), NullLogger<ConversationClient>.Instance));
        var sp = services.BuildServiceProvider();

        var httpCtx = new DefaultHttpContext { RequestServices = sp };
        httpCtx.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(json));

        await Assert.ThrowsAsync<OperationCanceledException>(() => bot.ProcessAsync(httpCtx));
    }

    [Fact]
    public async Task ProcessAsync_WrapsNonCancellationExceptions()
    {
        var json = """{"type":"message","serviceUrl":"https://example.com","conversation":{"id":"c1"}}""";
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new[] { new KeyValuePair<string, string?>("AzureAd:ClientId", "test-id") })
            .Build();
        var bot = new BotApplication(config, NullLogger<BotApplication>.Instance);
        bot.On("message", (ctx, ct) => throw new InvalidOperationException("handler bug"));

        var services = new ServiceCollection();
        services.AddKeyedSingleton<ConversationClient>("AzureAd",
            new ConversationClient(new HttpClient(), NullLogger<ConversationClient>.Instance));
        var sp = services.BuildServiceProvider();

        var httpCtx = new DefaultHttpContext { RequestServices = sp };
        httpCtx.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(json));

        var ex = await Assert.ThrowsAsync<BotHandlerException>(() => bot.ProcessAsync(httpCtx));
        Assert.IsType<InvalidOperationException>(ex.InnerException);
    }
}
