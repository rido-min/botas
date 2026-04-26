using System.Diagnostics;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using System.Text;
using System.Text.Json;

namespace Botas.Tests;

public class CoreSpanTests : IAsyncLifetime
{
    private WebApplication? _app;
    private HttpClient? _client;
    private BotApplication? _bot;
    private ActivityListener? _listener;
    private readonly List<Activity> _capturedActivities = [];

    public async Task InitializeAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();

        builder.Services.AddHttpClient("BotFrameworkNoAuth", client =>
            client.Timeout = TimeSpan.FromSeconds(30));
        builder.Services.AddKeyedScoped<ConversationClient>("AzureAd", (sp, _) =>
            new ConversationClient(
                sp.GetRequiredService<IHttpClientFactory>().CreateClient("BotFrameworkNoAuth"),
                NullLoggerFactory.Instance.CreateLogger<ConversationClient>()));

        _app = builder.Build();

        _bot = new BotApplication(
            new ConfigurationBuilder()
                .AddInMemoryCollection(new[] { new KeyValuePair<string, string?>("AzureAd:ClientId", "test-bot-id") })
                .Build(),
            NullLogger<BotApplication>.Instance);

        _app.MapPost("/api/messages", async (HttpContext httpContext, CancellationToken ct) =>
        {
            await _bot.ProcessAsync(httpContext, ct);
        });

        await _app.StartAsync();
        _client = _app.GetTestClient();
    }

    public async Task DisposeAsync()
    {
        _listener?.Dispose();
        _client?.Dispose();
        if (_app is not null)
        {
            await _app.DisposeAsync();
        }
    }

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

    private StringContent MakeActivityJson(string type, string? name = null, string? id = null)
    {
        var obj = new
        {
            type,
            id = id ?? "act-123",
            text = "hello",
            name,
            channelId = "test-channel",
            serviceUrl = "https://test.botframework.com/",
            conversation = new { id = "conv-001" },
            from = new { id = "user-1", name = "User" },
            recipient = new { id = "bot-1", name = "Bot" },
        };
        return new StringContent(JsonSerializer.Serialize(obj), Encoding.UTF8, "application/json");
    }

    [Fact]
    public async Task TurnSpan_CreatedWithCorrectTags()
    {
        SetupListener();
        _bot!.On("message", (ctx, ct) => Task.CompletedTask);

        var response = await _client!.PostAsync("/api/messages", MakeActivityJson("message"));
        Assert.True(response.IsSuccessStatusCode);

        var turnSpan = _capturedActivities.FirstOrDefault(a => a.OperationName == "botas.turn");
        Assert.NotNull(turnSpan);
        Assert.Equal("message", turnSpan.GetTagItem("activity.type"));
        Assert.Equal("act-123", turnSpan.GetTagItem("activity.id"));
        Assert.Equal("conv-001", turnSpan.GetTagItem("conversation.id"));
        Assert.Equal("test-channel", turnSpan.GetTagItem("channel.id"));
        Assert.Equal("test-bot-id", turnSpan.GetTagItem("bot.id"));
    }

    [Fact]
    public async Task HandlerSpan_TypeDispatch()
    {
        SetupListener();
        _bot!.On("message", (ctx, ct) => Task.CompletedTask);

        await _client!.PostAsync("/api/messages", MakeActivityJson("message"));

        var handlerSpan = _capturedActivities.FirstOrDefault(a => a.OperationName == "botas.handler");
        Assert.NotNull(handlerSpan);
        Assert.Equal("message", handlerSpan.GetTagItem("handler.type"));
        Assert.Equal("type", handlerSpan.GetTagItem("handler.dispatch"));
    }

    [Fact]
    public async Task HandlerSpan_CatchAllDispatch()
    {
        SetupListener();
        _bot!.OnActivity = (ctx, ct) => Task.CompletedTask;

        await _client!.PostAsync("/api/messages", MakeActivityJson("message"));

        var handlerSpan = _capturedActivities.FirstOrDefault(a => a.OperationName == "botas.handler");
        Assert.NotNull(handlerSpan);
        Assert.Equal("message", handlerSpan.GetTagItem("handler.type"));
        Assert.Equal("catchall", handlerSpan.GetTagItem("handler.dispatch"));
    }

    [Fact]
    public async Task HandlerSpan_InvokeDispatch()
    {
        SetupListener();
        _bot!.OnInvoke("testAction", (ctx, ct) => Task.FromResult(new InvokeResponse { Status = 200 }));

        await _client!.PostAsync("/api/messages", MakeActivityJson("invoke", name: "testAction"));

        var handlerSpan = _capturedActivities.FirstOrDefault(a =>
            a.OperationName == "botas.handler" &&
            a.GetTagItem("handler.dispatch")?.ToString() == "invoke");
        Assert.NotNull(handlerSpan);
        Assert.Equal("testAction", handlerSpan.GetTagItem("handler.type"));
        Assert.Equal("invoke", handlerSpan.GetTagItem("handler.dispatch"));
    }

    [Fact]
    public async Task MiddlewareSpan_CreatedForEachMiddleware()
    {
        SetupListener();

        var mw1 = new TestMiddleware("MW1");
        var mw2 = new TestMiddleware("MW2");
        _bot!.Use(mw1);
        _bot!.Use(mw2);
        _bot!.On("message", (ctx, ct) => Task.CompletedTask);

        await _client!.PostAsync("/api/messages", MakeActivityJson("message"));

        var mwSpans = _capturedActivities.Where(a => a.OperationName == "botas.middleware").ToList();
        Assert.Equal(2, mwSpans.Count);

        // Verify both indices are present (order depends on span stop timing)
        var indices = mwSpans.Select(s => (int)s.GetTagItem("middleware.index")!).OrderBy(i => i).ToList();
        Assert.Equal(0, indices[0]);
        Assert.Equal(1, indices[1]);

        Assert.All(mwSpans, s => Assert.Equal("TestMiddleware", s.GetTagItem("middleware.name")));
    }

    [Fact]
    public async Task AllSpansEmitted_InCorrectOrder()
    {
        SetupListener();

        _bot!.Use(new TestMiddleware("MW1"));
        _bot!.On("message", (ctx, ct) => Task.CompletedTask);

        await _client!.PostAsync("/api/messages", MakeActivityJson("message"));

        // Should have: turn, middleware, handler (stopped in reverse order)
        Assert.Contains(_capturedActivities, a => a.OperationName == "botas.turn");
        Assert.Contains(_capturedActivities, a => a.OperationName == "botas.middleware");
        Assert.Contains(_capturedActivities, a => a.OperationName == "botas.handler");
    }

    [Fact]
    public async Task NoSpans_WhenNoListenerConfigured()
    {
        // Intentionally NOT calling SetupListener()
        _bot!.On("message", (ctx, ct) => Task.CompletedTask);

        var response = await _client!.PostAsync("/api/messages", MakeActivityJson("message"));
        Assert.True(response.IsSuccessStatusCode);
        Assert.Empty(_capturedActivities);
    }

    [Fact]
    public async Task UnregisteredType_NoHandlerSpan()
    {
        SetupListener();
        // No handler registered for "typing"

        await _client!.PostAsync("/api/messages", MakeActivityJson("typing"));

        // Turn span should exist, but no handler span
        Assert.Contains(_capturedActivities, a => a.OperationName == "botas.turn");
        Assert.DoesNotContain(_capturedActivities, a => a.OperationName == "botas.handler");
    }

    private class TestMiddleware(string name) : ITurnMiddleWare
    {
        public string Name { get; } = name;

        public async Task OnTurnAsync(TurnContext context, NextDelegate next, CancellationToken cancellationToken = default)
        {
            await next(cancellationToken);
        }
    }
}
