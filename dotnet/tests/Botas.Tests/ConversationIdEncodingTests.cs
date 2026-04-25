using Microsoft.Extensions.Logging.Abstractions;

namespace Botas.Tests;

/// <summary>
/// Issue #280: Conversation IDs must be fully URL-encoded, not truncated at semicolons.
/// </summary>
public class ConversationIdEncodingTests
{
    [Fact]
    public async Task SendActivityAsync_EncodesConversationIdWithSemicolons()
    {
        string? capturedUrl = null;
        var handler = new CaptureUrlHandler(url => capturedUrl = url);
        var httpClient = new HttpClient(handler);
        var client = new ConversationClient(httpClient, NullLogger<ConversationClient>.Instance);

        var activity = new CoreActivity
        {
            Type = "message",
            Text = "hello",
            ServiceUrl = "http://localhost:3978/",
            Conversation = new() { Id = "a]concat-123;messageid=9876" }
        };

        await client.SendActivityAsync(activity);

        Assert.NotNull(capturedUrl);
        // Semicolon must be encoded as %3B, not truncated
        Assert.Contains("%3B", capturedUrl, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("messageid", capturedUrl);
        // ] must be encoded
        Assert.Contains("%5D", capturedUrl, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SendActivityAsync_EncodesSimpleConversationId()
    {
        string? capturedUrl = null;
        var handler = new CaptureUrlHandler(url => capturedUrl = url);
        var httpClient = new HttpClient(handler);
        var client = new ConversationClient(httpClient, NullLogger<ConversationClient>.Instance);

        var activity = new CoreActivity
        {
            Type = "message",
            Text = "hello",
            ServiceUrl = "http://localhost:3978/",
            Conversation = new() { Id = "simple-conv-123" }
        };

        await client.SendActivityAsync(activity);

        Assert.NotNull(capturedUrl);
        Assert.Contains("simple-conv-123", capturedUrl);
    }

    /// <summary>
    /// Test HTTP handler that captures the request URL and returns 200 OK.
    /// </summary>
    private class CaptureUrlHandler(Action<string> onRequest) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            onRequest(request.RequestUri?.ToString() ?? "");
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent("{\"id\":\"test\"}", System.Text.Encoding.UTF8, "application/json")
            });
        }
    }
}
