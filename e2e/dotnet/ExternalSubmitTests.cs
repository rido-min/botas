using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Botas.E2ETests;

/// <summary>
/// E2E tests for Action.Submit handling against a bot running in a separate process.
/// Action.Submit produces a message activity with flat activity.value (no text).
/// The test-bot detects this and echoes "Submit received: {value}".
/// Requires CLIENT_ID, CLIENT_SECRET, TENANT_ID env vars for token acquisition.
/// </summary>
public abstract class ExternalSubmitTests : IAsyncLifetime
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
    public async Task Bot_EchoesValue_ForActionSubmit()
    {
        string conversationId = Guid.NewGuid().ToString();
        var submitData = new { source = "e2e", action = "submit" };

        // Action.Submit sends a message activity with value but no text
        CoreActivity activity = new("message")
        {
            Value = JsonSerializer.SerializeToElement(submitData),
            ServiceUrl = _callbackServer.BaseUrl,
            Conversation = new Conversation { Id = conversationId },
            From = new ChannelAccount { Id = "user1" },
            Recipient = new ChannelAccount { Id = "bot1" },
        };

        Task<CoreActivity> replyTask = _callbackServer.WaitForActivityAsync();

        HttpResponseMessage response = await SendAuthorizedAsync(activity);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        CoreActivity reply = await replyTask;
        Assert.Equal("message", reply.Type);
        Assert.Contains("Submit received:", reply.Text);
        Assert.Contains("e2e", reply.Text);
        Assert.Contains("submit", reply.Text);
    }

    private async Task<HttpResponseMessage> SendAuthorizedAsync(CoreActivity activity)
    {
        HttpRequestMessage request = new(HttpMethod.Post, _botEndpoint)
        {
            Content = new StringContent(activity.ToJson(), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
        return await _httpClient.SendAsync(request);
    }
}

[Trait("Category", "External")]
[Trait("Category", "SubmitDotNet")]
public sealed class DotNetSubmitTests : ExternalSubmitTests;

[Trait("Category", "External")]
[Trait("Category", "SubmitNode")]
public sealed class NodeSubmitTests : ExternalSubmitTests;

[Trait("Category", "External")]
[Trait("Category", "SubmitPython")]
public sealed class PythonSubmitTests : ExternalSubmitTests;
