using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Botas.E2ETests;

/// <summary>
/// E2E tests for invoke activity handling against a bot running in a separate process.
/// Each test-bot sample registers a "test/echo" invoke handler that echoes the activity value.
/// Requires CLIENT_ID, CLIENT_SECRET, TENANT_ID env vars for token acquisition.
/// </summary>
public abstract class ExternalInvokeTests : IAsyncLifetime
{
    private HttpClient _httpClient = null!;
    private string _botEndpoint = null!;
    private string _token = null!;

    public async Task InitializeAsync()
    {
        _httpClient = new HttpClient();
        _botEndpoint = Environment.GetEnvironmentVariable("BOT_URL") ?? "http://localhost:3978";
        _botEndpoint = _botEndpoint.TrimEnd('/') + "/api/messages";
        _token = await TokenProvider.GetTokenAsync();
    }

    public Task DisposeAsync()
    {
        _httpClient.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Bot_ReturnsInvokeResponse_ForHandledInvoke()
    {
        var payload = new { greeting = "hello", count = 42 };
        CoreActivity activity = BuildInvokeActivity("test/echo", payload);

        HttpResponseMessage response = await SendAuthorizedAsync(activity);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        string body = await response.Content.ReadAsStringAsync();
        using JsonDocument doc = JsonDocument.Parse(body);
        Assert.Equal("hello", doc.RootElement.GetProperty("greeting").GetString());
        Assert.Equal(42, doc.RootElement.GetProperty("count").GetInt32());
    }

    [Fact]
    public async Task Bot_Returns501_ForUnhandledInvoke()
    {
        CoreActivity activity = BuildInvokeActivity("unknown/action", new { data = "ignored" });

        HttpResponseMessage response = await SendAuthorizedAsync(activity);

        Assert.Equal((HttpStatusCode)501, response.StatusCode);
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

    private static CoreActivity BuildInvokeActivity(string name, object value) => new("invoke")
    {
        Name = name,
        Value = JsonSerializer.SerializeToElement(value),
        ServiceUrl = "https://test.botframework.com/",
        Conversation = new Conversation { Id = Guid.NewGuid().ToString() },
        From = new ChannelAccount { Id = "user1" },
        Recipient = new ChannelAccount { Id = "bot1" },
    };
}

[Trait("Category", "External")]
[Trait("Category", "InvokeDotNet")]
public sealed class DotNetInvokeTests : ExternalInvokeTests;

[Trait("Category", "External")]
[Trait("Category", "InvokeNode")]
public sealed class NodeInvokeTests : ExternalInvokeTests;

[Trait("Category", "External")]
[Trait("Category", "InvokePython")]
public sealed class PythonInvokeTests : ExternalInvokeTests;
