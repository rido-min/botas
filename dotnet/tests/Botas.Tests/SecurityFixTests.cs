using Xunit;

namespace Botas.Tests;

/// <summary>
/// Tests for P1 security fixes (#99, #107).
/// </summary>
public class ServiceUrlValidationTests
{
    [Theory]
    [InlineData("https://smba.trafficmanager.net/teams/", true)] // Azure Traffic Manager (Teams)
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
