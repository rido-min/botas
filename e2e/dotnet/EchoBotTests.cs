using Botas.Schema;
using System.Net;
using System.Net.Http.Headers;
using System.Text;

namespace Botas.E2ETests;

public sealed class EchoBotTests : IAsyncLifetime
{
    private readonly EchoBotFactory _factory = new();
    private ConversationService _channel = null!;
    private HttpClient _botClient = null!;

    public async Task InitializeAsync()
    {
        _channel = new ConversationService();
        await _channel.StartAsync();
        _botClient = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        _botClient.Dispose();
        await _factory.DisposeAsync();
        await _channel.DisposeAsync();
    }

    [Fact]
    public async Task EchoBot_Returns401_WhenNoBearerToken()
    {
        HttpResponseMessage response = await _botClient.PostAsync(
            "/api/messages",
            Serialize(BuildActivity("hello")));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task EchoBot_Returns401_WhenInvalidBearerToken()
    {
        HttpResponseMessage response = await _botClient.SendAsync(
            AuthorizedRequest("not-a-valid-jwt", BuildActivity("hello")));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task EchoBot_Returns200_WhenValidBearerToken()
    {
        HttpResponseMessage response = await _botClient.SendAsync(
            AuthorizedRequest(TestJwt.Generate(), BuildActivity("hello")));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task EchoBot_SendsActivityToConversationService_WhenMessageReceived()
    {
        // Set up TCS before sending — avoids a race between the bot calling back and the test awaiting
        Task<CoreActivity> activityTask = _channel.WaitForActivityAsync();

        HttpResponseMessage response = await _botClient.SendAsync(
            AuthorizedRequest(TestJwt.Generate(), BuildActivity("hello")));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        CoreActivity sent = await activityTask;
        Assert.Equal("message", sent.Type);
        Assert.Equal("Echo: hello, from aspnet", sent.Text);
        Assert.Equal("conv-1", sent.Conversation?.Id);
    }

    private CoreActivity BuildActivity(string text) => new("message")
    {
        Text = text,
        ServiceUrl = _channel.BaseUrl,
        Conversation = new Conversation { Id = "conv-1" },
        From = new ChannelAccount { Id = "user1" },
        Recipient = new ChannelAccount { Id = "bot1" },
    };

    private static HttpRequestMessage AuthorizedRequest(string token, CoreActivity activity)
    {
        HttpRequestMessage request = new(HttpMethod.Post, "/api/messages")
        {
            Content = Serialize(activity)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private static StringContent Serialize(CoreActivity activity) =>
        new(activity.ToJson(), Encoding.UTF8, "application/json");
}
