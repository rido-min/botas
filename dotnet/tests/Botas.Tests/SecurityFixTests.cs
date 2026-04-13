using Xunit;

namespace Botas.Tests;

/// <summary>
/// Tests for P1 security fixes (#99, #107).
/// </summary>
public class ServiceUrlValidationTests
{
    [Theory]
    [InlineData("https://smba.trafficmanager.net/teams/", false)] // not in allowlist
    [InlineData("https://service.botframework.com/", true)]
    [InlineData("https://us-api.botframework.us/", true)]
    [InlineData("https://api.botframework.cn/", true)]
    [InlineData("https://smba.trafficmanager.botframework.com/", true)]
    [InlineData("https://localhost/", true)]
    [InlineData("https://127.0.0.1/", true)]
    public void ValidateServiceUrl_AllowsOnlyKnownHosts(string url, bool shouldSucceed)
    {
        if (shouldSucceed)
        {
            ConversationClient.ValidateServiceUrl(url); // should not throw
        }
        else
        {
            Assert.Throws<ArgumentException>(() => ConversationClient.ValidateServiceUrl(url));
        }
    }

    [Fact]
    public void ValidateServiceUrl_RejectsHttp()
    {
        Assert.Throws<ArgumentException>(() =>
            ConversationClient.ValidateServiceUrl("http://service.botframework.com/"));
    }

    [Fact]
    public void ValidateServiceUrl_RejectsNull()
    {
        Assert.Throws<ArgumentException>(() =>
            ConversationClient.ValidateServiceUrl(null));
    }

    [Fact]
    public void ValidateServiceUrl_RejectsAttackerUrl()
    {
        Assert.Throws<ArgumentException>(() =>
            ConversationClient.ValidateServiceUrl("https://evil.attacker.com/"));
    }

    [Fact]
    public void ValidateServiceUrl_RejectsInternalUrl()
    {
        Assert.Throws<ArgumentException>(() =>
            ConversationClient.ValidateServiceUrl("https://metadata.internal/"));
    }

    [Fact]
    public void ValidateServiceUrl_RejectsSpoofedSuffix()
    {
        // An attacker might try evil-botframework.com
        Assert.Throws<ArgumentException>(() =>
            ConversationClient.ValidateServiceUrl("https://evil-botframework.com/"));
    }
}

public class JwtIssuerValidationTests
{
    [Fact]
    public void IsKnownIssuer_ReturnsTrueForBotFrameworkIssuer()
    {
        string[] validIssuers = ["https://api.botframework.com", "https://sts.windows.net/tenant-123/"];
        Assert.True(JwtExtensions.IsKnownIssuer("https://api.botframework.com", validIssuers));
    }

    [Fact]
    public void IsKnownIssuer_ReturnsTrueForTenantIssuer()
    {
        string[] validIssuers = ["https://api.botframework.com", "https://sts.windows.net/tenant-123/"];
        Assert.True(JwtExtensions.IsKnownIssuer("https://sts.windows.net/tenant-123/", validIssuers));
    }

    [Fact]
    public void IsKnownIssuer_ReturnsFalseForAttackerIssuer()
    {
        string[] validIssuers = ["https://api.botframework.com", "https://sts.windows.net/tenant-123/"];
        Assert.False(JwtExtensions.IsKnownIssuer("https://evil.attacker.com", validIssuers));
    }

    [Fact]
    public void IsKnownIssuer_ReturnsFalseForNullIssuer()
    {
        string[] validIssuers = ["https://api.botframework.com"];
        Assert.False(JwtExtensions.IsKnownIssuer(null!, validIssuers));
    }

    [Fact]
    public void IsKnownIssuer_IsCaseInsensitive()
    {
        string[] validIssuers = ["https://api.botframework.com"];
        Assert.True(JwtExtensions.IsKnownIssuer("HTTPS://API.BOTFRAMEWORK.COM", validIssuers));
    }
}

/// <summary>
/// Tests for P2 fixes (#105, #106).
/// </summary>
public class P2FixTests
{
    [Fact]
    public void ConversationClient_SetsExplicitTimeout()
    {
        // #106: Verify HttpClient timeout is set to 30 seconds
        var httpClient = new HttpClient();
        var logger = new Microsoft.Extensions.Logging.Abstractions.NullLogger<ConversationClient>();

        _ = new ConversationClient(httpClient, logger);

        Assert.Equal(TimeSpan.FromSeconds(30), httpClient.Timeout);
    }

    [Fact]
    public void ConversationClient_DoesNotOverrideShorterTimeout()
    {
        // #106: If a shorter timeout is already set, don't override it
        var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        var logger = new Microsoft.Extensions.Logging.Abstractions.NullLogger<ConversationClient>();

        _ = new ConversationClient(httpClient, logger);

        Assert.Equal(TimeSpan.FromSeconds(10), httpClient.Timeout);
    }

    [Fact]
    public async Task SendActivityAsync_ErrorDoesNotExposeResponseBody()
    {
        // #105: Verify error messages don't include upstream response body
        var handler = new FakeHttpHandler(System.Net.HttpStatusCode.InternalServerError, "secret internal error details");
        var httpClient = new HttpClient(handler);
        var logger = new Microsoft.Extensions.Logging.Abstractions.NullLogger<ConversationClient>();
        var client = new ConversationClient(httpClient, logger);

        var activity = new CoreActivity
        {
            Type = "message",
            ServiceUrl = "https://smba.botframework.com/",
            Conversation = new Conversation { Id = "conv1" },
            Text = "test"
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => client.SendActivityAsync(activity));

        // Error message should contain status code but NOT the response body
        Assert.Contains("InternalServerError", ex.Message);
        Assert.DoesNotContain("secret internal error details", ex.Message);
    }

    private class FakeHttpHandler(System.Net.HttpStatusCode statusCode, string responseBody) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(responseBody)
            });
        }
    }
}
