using System.Net;
using System.Net.Http.Headers;
using System.Text;

namespace Botas.E2ETests;

/// <summary>
/// Base class for e2e tests that send authenticated activities to a bot running in a separate process.
/// Requires CLIENT_ID, CLIENT_SECRET, TENANT_ID env vars for token acquisition.
/// Derived classes add a Trait("Category", "...") per bot language.
/// </summary>
public abstract class ExternalEchoBotTests : IAsyncLifetime
{
    private ConversationService _callbackServer = null!;
    private HttpClient _httpClient = null!;
    private string _botEndpoint = null!;
    private string _token = null!;

    public async Task InitializeAsync()
    {
        _callbackServer = new ConversationService();
        await _callbackServer.StartAsync();

        _httpClient = new HttpClient();
        _botEndpoint = Environment.GetEnvironmentVariable("BOT_URL") ?? "http://localhost:3978";
        _botEndpoint = _botEndpoint.TrimEnd('/') + "/api/messages";

        _token = await TokenProvider.GetTokenAsync();
    }

    public async Task DisposeAsync()
    {
        _httpClient.Dispose();
        await _callbackServer.DisposeAsync();
    }

    [Fact]
    public async Task Bot_EchoesMessage()
    {
        string conversationId = Guid.NewGuid().ToString();
        CoreActivity activity = BuildActivity("hello from test", conversationId);

        Task<CoreActivity> replyTask = _callbackServer.WaitForActivityAsync();

        HttpResponseMessage response = await SendAuthorizedAsync(activity);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        CoreActivity reply = await replyTask;
        Assert.Equal("message", reply.Type);
        Assert.Contains("hello from test", reply.Text);
        Assert.Equal(conversationId, reply.Conversation?.Id);
    }

    [Fact]
    public async Task Bot_ReturnsOk_ForUnknownActivityType()
    {
        string conversationId = Guid.NewGuid().ToString();
        CoreActivity activity = new("unknownType")
        {
            Text = "ignored",
            ServiceUrl = _callbackServer.BaseUrl,
            Conversation = new Conversation { Id = conversationId },
            From = new ChannelAccount { Id = "user1" },
            Recipient = new ChannelAccount { Id = "bot1" },
        };

        HttpResponseMessage response = await SendAuthorizedAsync(activity);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Bot should not reply for unknown activity types — wait briefly to confirm no callback
        await Assert.ThrowsAsync<TimeoutException>(() =>
            _callbackServer.WaitForActivityAsync(TimeSpan.FromSeconds(2)));
    }

    [Fact]
    public async Task Bot_Returns401_WithoutToken()
    {
        string conversationId = Guid.NewGuid().ToString();
        CoreActivity activity = BuildActivity("hello", conversationId);

        HttpResponseMessage response = await _httpClient.PostAsync(
            _botEndpoint,
            Serialize(activity));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task<HttpResponseMessage> SendAuthorizedAsync(CoreActivity activity)
    {
        HttpRequestMessage request = new(HttpMethod.Post, _botEndpoint)
        {
            Content = Serialize(activity)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
        return await _httpClient.SendAsync(request);
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

[Trait("Category", "External")]
[Trait("Category", "Node")]
public sealed class NodeEchoBotTests : ExternalEchoBotTests;

[Trait("Category", "External")]
[Trait("Category", "DotNet")]
public sealed class DotNetEchoBotTests : ExternalEchoBotTests;

[Trait("Category", "External")]
[Trait("Category", "Python")]
public sealed class PythonEchoBotTests : ExternalEchoBotTests;
