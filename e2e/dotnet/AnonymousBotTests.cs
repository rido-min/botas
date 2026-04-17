using System.Net;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;

namespace Botas.E2ETests;

/// <summary>
/// Tests that BotApp works without authentication when AzureAd:ClientId is not configured.
/// These are in-process tests — no external bot process needed.
/// </summary>
public sealed class AnonymousBotTests : IAsyncLifetime
{
    private WebApplication _botApp = null!;
    private string _botUrl = null!;
    private ConversationService _callbackServer = null!;
    private HttpClient _httpClient = null!;

    public async Task InitializeAsync()
    {
        // Start a callback server to capture bot responses
        _callbackServer = new ConversationService();
        await _callbackServer.StartAsync();

        // Start a minimal bot WITHOUT AzureAd config — triggers no-auth path in BotApp
        WebApplicationBuilder builder = WebApplication.CreateSlimBuilder();
        builder.Services.AddSingleton<BotApplication>(sp =>
            new BotApplication(
                sp.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>(),
                sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<BotApplication>>()));
        builder.Services.AddKeyedScoped<ConversationClient>("AzureAd", (_, _) =>
            new ConversationClient(
                new HttpClient(),
                Microsoft.Extensions.Logging.Abstractions.NullLogger<ConversationClient>.Instance));

        _botApp = builder.Build();

        var bot = _botApp.Services.GetRequiredService<BotApplication>();
        bot.On("message", async (ctx, ct) =>
        {
            await ctx.SendAsync($"Echo: {ctx.Activity.Text}, anonymous", ct);
        });

        _botApp.MapPost("api/messages", async (Microsoft.AspNetCore.Http.HttpContext httpContext, CancellationToken ct) =>
        {
            await bot.ProcessAsync(httpContext, ct);
        });

        _botApp.Urls.Add("http://127.0.0.1:0");
        await _botApp.StartAsync();

        var addresses = _botApp.Services
            .GetRequiredService<IServer>()
            .Features
            .Get<IServerAddressesFeature>()!;
        _botUrl = addresses.Addresses.First().TrimEnd('/') + "/api/messages";

        _httpClient = new HttpClient();
    }

    public async Task DisposeAsync()
    {
        _httpClient.Dispose();
        await _botApp.DisposeAsync();
        await _callbackServer.DisposeAsync();
    }

    [Fact]
    public async Task AnonymousBot_AcceptsRequestWithoutToken()
    {
        string conversationId = Guid.NewGuid().ToString();
        CoreActivity activity = BuildActivity("hello anonymous", conversationId);

        Task<CoreActivity> replyTask = _callbackServer.WaitForActivityAsync();

        HttpResponseMessage response = await _httpClient.PostAsync(
            _botUrl,
            Serialize(activity));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        CoreActivity reply = await replyTask;
        Assert.Equal("message", reply.Type);
        Assert.Contains("hello anonymous", reply.Text);
    }

    [Fact]
    public async Task AnonymousBot_ProcessesUnknownActivityTypeWithoutError()
    {
        string conversationId = Guid.NewGuid().ToString();
        CoreActivity activity = new("customType")
        {
            Text = "test",
            ServiceUrl = _callbackServer.BaseUrl,
            Conversation = new Conversation { Id = conversationId },
            From = new ChannelAccount { Id = "user1" },
            Recipient = new ChannelAccount { Id = "bot1" },
        };

        HttpResponseMessage response = await _httpClient.PostAsync(
            _botUrl,
            Serialize(activity));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private CoreActivity BuildActivity(string text, string conversationId) => new("message")
    {
        Text = text,
        ServiceUrl = _callbackServer.BaseUrl,
        Conversation = new Conversation { Id = conversationId },
        From = new ChannelAccount { Id = "user1" },
        Recipient = new ChannelAccount { Id = "bot1" },
    };

    private static StringContent Serialize(CoreActivity activity) =>
        new(activity.ToJson(), Encoding.UTF8, "application/json");
}
