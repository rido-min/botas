using System.Net;
using System.Net.Http.Headers;
using System.Text;

namespace Botas.E2ETests;

/// <summary>
/// E2E tests for AI-powered bot samples.
/// Validates that each AI sample processes a message and returns a non-empty AI-generated response.
/// Requires CLIENT_ID, CLIENT_SECRET, TENANT_ID env vars for token acquisition,
/// and AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT for the AI model.
/// The bot must be running externally on BOT_URL (default: http://localhost:3978).
/// </summary>
public abstract class ExternalAiBotTests : IAsyncLifetime
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
    public async Task AiBot_ReturnsNonEmptyResponse()
    {
        string conversationId = Guid.NewGuid().ToString();
        CoreActivity activity = BuildActivity("What is 2+2? Reply with just the number.", conversationId);

        Task<CoreActivity> replyTask = _callbackServer.WaitForActivityAsync(TimeSpan.FromSeconds(30));

        HttpResponseMessage response = await SendAuthorizedAsync(activity);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        CoreActivity reply = await replyTask;
        Assert.Equal("message", reply.Type);
        Assert.False(string.IsNullOrWhiteSpace(reply.Text), "AI bot should return a non-empty response");
    }

    [Fact]
    public async Task AiBot_ReturnsContextualResponse()
    {
        string conversationId = Guid.NewGuid().ToString();
        CoreActivity activity = BuildActivity("What is the capital of France? Reply in one word.", conversationId);

        Task<CoreActivity> replyTask = _callbackServer.WaitForActivityAsync(TimeSpan.FromSeconds(30));

        HttpResponseMessage response = await SendAuthorizedAsync(activity);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        CoreActivity reply = await replyTask;
        Assert.Equal("message", reply.Type);
        Assert.Contains("Paris", reply.Text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AiBot_MaintainsConversationHistory()
    {
        string conversationId = Guid.NewGuid().ToString();

        // First message — establish context
        CoreActivity firstActivity = BuildActivity("My name is TestBot123. Remember it.", conversationId);
        Task<CoreActivity> firstReplyTask = _callbackServer.WaitForActivityAsync(TimeSpan.FromSeconds(30));
        HttpResponseMessage firstResponse = await SendAuthorizedAsync(firstActivity);
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        await firstReplyTask; // consume the reply

        // Second message — verify memory
        CoreActivity secondActivity = BuildActivity("What is my name?", conversationId);
        Task<CoreActivity> secondReplyTask = _callbackServer.WaitForActivityAsync(TimeSpan.FromSeconds(30));
        HttpResponseMessage secondResponse = await SendAuthorizedAsync(secondActivity);
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);

        CoreActivity secondReply = await secondReplyTask;
        Assert.Contains("TestBot123", secondReply.Text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AiBot_ReturnsOk_ForUnknownActivityType()
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

        // Bot should not reply for unknown activity types
        await Assert.ThrowsAsync<TimeoutException>(() =>
            _callbackServer.WaitForActivityAsync(TimeSpan.FromSeconds(3)));
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
[Trait("Category", "AI")]
[Trait("Category", "DotNet")]
public sealed class DotNetAiBotTests : ExternalAiBotTests;

[Trait("Category", "External")]
[Trait("Category", "AI")]
[Trait("Category", "Node")]
public sealed class NodeAiVercelBotTests : ExternalAiBotTests;

[Trait("Category", "External")]
[Trait("Category", "AI")]
[Trait("Category", "NodeLangchain")]
public sealed class NodeAiLangchainBotTests : ExternalAiBotTests;

[Trait("Category", "External")]
[Trait("Category", "AI")]
[Trait("Category", "Python")]
public sealed class PythonAiLangchainBotTests : ExternalAiBotTests;

[Trait("Category", "External")]
[Trait("Category", "AI")]
[Trait("Category", "PythonAgent")]
public sealed class PythonAiAgentBotTests : ExternalAiBotTests;
