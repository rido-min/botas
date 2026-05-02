using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Identity.Abstractions;
using Moq;
using Moq.Protected;
using System.Diagnostics;
using System.Net;
using System.Text;

namespace Botas.Tests;

[Collection("ActivitySource")]
public class AuthAndConversationClientSpanTests : IDisposable
{
    private ActivityListener? _listener;
    private readonly List<Activity> _capturedActivities = [];

    private void SetupListener()
    {
        _capturedActivities.Clear();
        _listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "botas",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllData,
            ActivityStopped = activity => _capturedActivities.Add(activity),
        };
        ActivitySource.AddActivityListener(_listener);
    }

    public void Dispose()
    {
        _listener?.Dispose();
    }

    #region botas.auth.outbound tests

    [Fact]
    public async Task AuthOutbound_SpanCreated_WithCorrectAttributes()
    {
        SetupListener();
        var scope = "https://api.botframework.com/.default";
        var (handler, client) = CreateAuthHandler(scope);

        await client.GetAsync("https://api.example.com/test");

        var span = _capturedActivities.FirstOrDefault(a => a.OperationName == "botas.auth.outbound");
        Assert.NotNull(span);
        Assert.Equal(scope, span.GetTagItem("auth.scope"));
        Assert.Equal("client_credentials", span.GetTagItem("auth.flow"));
        Assert.Equal(false, span.GetTagItem("auth.cache_hit"));
    }

    [Fact]
    public async Task AuthOutbound_NoSpan_WhenNoListenerConfigured()
    {
        // Intentionally NOT calling SetupListener()
        var scope = "https://api.botframework.com/.default";
        var (handler, client) = CreateAuthHandler(scope);

        await client.GetAsync("https://api.example.com/test");

        Assert.Empty(_capturedActivities);
    }

    [Fact]
    public async Task AuthOutbound_SetsErrorStatus_OnFailure()
    {
        SetupListener();
        var scope = "https://api.botframework.com/.default";

        var mockAuthProvider = new Mock<IAuthorizationHeaderProvider>();
        mockAuthProvider.Setup(a => a.CreateAuthorizationHeaderForAppAsync(
                It.IsAny<string>(), It.IsAny<AuthorizationHeaderProviderOptions?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Token acquisition failed"));

        var mockInner = new Mock<HttpMessageHandler>();
        var logger = NullLoggerFactory.Instance.CreateLogger<BotAuthenticationHandler>();
        var handler = new BotAuthenticationHandler(mockAuthProvider.Object, logger, scope)
        {
            InnerHandler = mockInner.Object
        };
        var client = new HttpClient(handler);

        await Assert.ThrowsAsync<InvalidOperationException>(() => client.GetAsync("https://api.example.com/test"));

        var span = _capturedActivities.FirstOrDefault(a => a.OperationName == "botas.auth.outbound");
        Assert.NotNull(span);
        Assert.Equal(ActivityStatusCode.Error, span.Status);
    }

    private (BotAuthenticationHandler handler, HttpClient client) CreateAuthHandler(string scope)
    {
        var mockAuthProvider = new Mock<IAuthorizationHeaderProvider>();
        mockAuthProvider.Setup(a => a.CreateAuthorizationHeaderForAppAsync(
                It.IsAny<string>(), It.IsAny<AuthorizationHeaderProviderOptions?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("Bearer test-token");

        var mockInner = new Mock<HttpMessageHandler>();
        mockInner.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
            });

        var logger = NullLoggerFactory.Instance.CreateLogger<BotAuthenticationHandler>();
        var handler = new BotAuthenticationHandler(mockAuthProvider.Object, logger, scope)
        {
            InnerHandler = mockInner.Object
        };
        return (handler, new HttpClient(handler));
    }

    #endregion

    #region botas.conversation_client tests

    [Fact]
    public async Task ConversationClient_SpanCreated_WithCorrectAttributes()
    {
        SetupListener();
        var (ccClient, _) = CreateConversationClient(HttpStatusCode.OK, "{\"id\":\"resp-1\"}");

        var activity = CreateTestActivity();
        await ccClient.SendActivityAsync(activity);

        var span = _capturedActivities.FirstOrDefault(a => a.OperationName == "botas.conversation_client");
        Assert.NotNull(span);
        Assert.Equal("conv-001", span.GetTagItem("conversation.id"));
        Assert.Equal("message", span.GetTagItem("activity.type"));
        Assert.Equal("https://test.botframework.com/", span.GetTagItem("service.url"));
    }

    [Fact]
    public async Task ConversationClient_NoSpan_WhenNoListenerConfigured()
    {
        // Intentionally NOT calling SetupListener()
        var (ccClient, _) = CreateConversationClient(HttpStatusCode.OK, "{\"id\":\"resp-1\"}");

        var activity = CreateTestActivity();
        await ccClient.SendActivityAsync(activity);

        Assert.Empty(_capturedActivities);
    }

    [Fact]
    public async Task ConversationClient_SetsErrorStatus_OnFailure()
    {
        SetupListener();
        var (ccClient, _) = CreateConversationClient(HttpStatusCode.InternalServerError, "{\"error\":\"fail\"}");

        var activity = CreateTestActivity();
        await Assert.ThrowsAsync<InvalidOperationException>(() => ccClient.SendActivityAsync(activity));

        var span = _capturedActivities.FirstOrDefault(a => a.OperationName == "botas.conversation_client");
        Assert.NotNull(span);
        Assert.Equal(ActivityStatusCode.Error, span.Status);
    }

    private CoreActivity CreateTestActivity()
    {
        var json = """
        {
            "type": "message",
            "text": "hello",
            "serviceUrl": "https://test.botframework.com/",
            "conversation": { "id": "conv-001" },
            "from": { "id": "bot-1", "name": "Bot" },
            "recipient": { "id": "user-1", "name": "User" }
        }
        """;
        return CoreActivity.FromJsonString(json);
    }

    private (ConversationClient client, Mock<HttpMessageHandler> mock) CreateConversationClient(HttpStatusCode statusCode, string responseContent)
    {
        var mockHandler = new Mock<HttpMessageHandler>();
        mockHandler.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(responseContent, Encoding.UTF8, "application/json")
            });

        var httpClient = new HttpClient(mockHandler.Object);
        var logger = NullLoggerFactory.Instance.CreateLogger<ConversationClient>();
        return (new ConversationClient(httpClient, logger), mockHandler);
    }

    #endregion
}
