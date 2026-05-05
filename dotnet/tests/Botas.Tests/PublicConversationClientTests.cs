using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Moq.Protected;
using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Botas.Tests;

/// <summary>
/// Tests for #342 — public ConversationClient access and CreateConversationAsync parity
/// with the Node.js and Python implementations.
/// </summary>
public class PublicConversationClientTests : IAsyncLifetime
{
    private WebApplication? _app;
    private HttpClient? _client;
    private BotApplication? _bot;
    private ConversationClient? _registeredClient;

    public async Task InitializeAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();

        builder.Services.AddHttpClient("BotFrameworkNoAuth", client => client.Timeout = TimeSpan.FromSeconds(30));
        builder.Services.AddKeyedScoped<ConversationClient>("AzureAd", (sp, _) =>
        {
            _registeredClient = new ConversationClient(
                sp.GetRequiredService<IHttpClientFactory>().CreateClient("BotFrameworkNoAuth"),
                NullLoggerFactory.Instance.CreateLogger<ConversationClient>());
            return _registeredClient;
        });

        _app = builder.Build();

        _bot = new BotApplication(new ConfigurationBuilder().Build(), NullLogger<BotApplication>.Instance);
        _bot.On("message", (ctx, ct) => Task.CompletedTask);

        _app.MapPost("/api/messages", async (HttpContext httpContext, CancellationToken ct) =>
        {
            await _bot.ProcessAsync(httpContext, ct);
        });

        await _app.StartAsync();
        _client = _app.GetTestClient();
    }

    public async Task DisposeAsync()
    {
        _client?.Dispose();
        if (_app != null)
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }
    }

    [Fact]
    public void ConversationClient_IsNull_BeforeAnyRequest()
    {
        var bot = new BotApplication();
        Assert.Null(bot.ConversationClient);
    }

    [Fact]
    public async Task ConversationClient_IsAccessible_AfterProcessAsync()
    {
        var activityJson = JsonSerializer.Serialize(new
        {
            type = "message",
            text = "hi",
            serviceUrl = "https://test.botframework.com/",
            conversation = new { id = "conv-1" },
            from = new { id = "user-1" },
            recipient = new { id = "bot-1" }
        });

        var resp = await _client!.PostAsync("/api/messages",
            new StringContent(activityJson, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        Assert.NotNull(_bot!.ConversationClient);
        Assert.Same(_registeredClient, _bot.ConversationClient);
    }

    [Fact]
    public async Task CreateConversationAsync_PostsToCorrectEndpoint_AndDeserializesResponse()
    {
        HttpRequestMessage? captured = null;
        var mockHandler = new Mock<HttpMessageHandler>();
        mockHandler.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) => captured = req)
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = new StringContent(
                    "{\"id\":\"new-conv-123\",\"serviceUrl\":\"https://test.botframework.com/\",\"activityId\":\"act-1\"}",
                    Encoding.UTF8,
                    "application/json")
            });

        var httpClient = new HttpClient(mockHandler.Object);
        var ccClient = new ConversationClient(httpClient,
            NullLoggerFactory.Instance.CreateLogger<ConversationClient>());

        var parameters = new ConversationParameters
        {
            IsGroup = false,
            Bot = new ChannelAccount { Id = "bot-1", Name = "Bot" },
            Members = [new ChannelAccount { Id = "user-1", Name = "User" }],
            TopicName = "Proactive thread",
            TenantId = "tenant-1"
        };

        var result = await ccClient.CreateConversationAsync(
            "https://test.botframework.com/",
            parameters);

        Assert.NotNull(result);
        Assert.Equal("new-conv-123", result!.Id);
        Assert.Equal("https://test.botframework.com/", result.ServiceUrl);
        Assert.Equal("act-1", result.ActivityId);

        Assert.NotNull(captured);
        Assert.Equal(HttpMethod.Post, captured!.Method);
        Assert.Equal("https://test.botframework.com/v3/conversations", captured.RequestUri!.ToString());

        var body = await captured.Content!.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("Proactive thread", doc.RootElement.GetProperty("topicName").GetString());
        Assert.Equal("tenant-1", doc.RootElement.GetProperty("tenantId").GetString());
        Assert.Equal("bot-1", doc.RootElement.GetProperty("bot").GetProperty("id").GetString());
    }

    [Fact]
    public async Task CreateConversationAsync_AppendsSlash_WhenServiceUrlMissingTrailingSlash()
    {
        HttpRequestMessage? captured = null;
        var mockHandler = new Mock<HttpMessageHandler>();
        mockHandler.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>((req, _) => captured = req)
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"id\":\"c\"}", Encoding.UTF8, "application/json")
            });

        var ccClient = new ConversationClient(
            new HttpClient(mockHandler.Object),
            NullLoggerFactory.Instance.CreateLogger<ConversationClient>());

        await ccClient.CreateConversationAsync(
            "https://test.botframework.com",
            new ConversationParameters());

        Assert.Equal("https://test.botframework.com/v3/conversations", captured!.RequestUri!.ToString());
    }

    [Fact]
    public async Task CreateConversationAsync_Throws_OnNonSuccessStatus()
    {
        var mockHandler = new Mock<HttpMessageHandler>();
        mockHandler.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = new StringContent("{\"error\":\"bad\"}", Encoding.UTF8, "application/json")
            });

        var ccClient = new ConversationClient(
            new HttpClient(mockHandler.Object),
            NullLoggerFactory.Instance.CreateLogger<ConversationClient>());

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            ccClient.CreateConversationAsync(
                "https://test.botframework.com/",
                new ConversationParameters()));

        Assert.Contains("BadRequest", ex.Message);
    }

    [Fact]
    public async Task CreateConversationAsync_Throws_OnDisallowedServiceUrl()
    {
        var ccClient = new ConversationClient(
            new HttpClient(),
            NullLoggerFactory.Instance.CreateLogger<ConversationClient>());

        await Assert.ThrowsAsync<ArgumentException>(() =>
            ccClient.CreateConversationAsync(
                "https://evil.example.com/",
                new ConversationParameters()));
    }

    [Fact]
    public async Task CreateConversationAsync_Throws_OnNullParameters()
    {
        var ccClient = new ConversationClient(
            new HttpClient(),
            NullLoggerFactory.Instance.CreateLogger<ConversationClient>());

        await Assert.ThrowsAsync<ArgumentNullException>(() =>
            ccClient.CreateConversationAsync("https://test.botframework.com/", null!));
    }
}
