using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Identity.Abstractions;
using Moq;
using Moq.Protected;
using System.Collections.Specialized;
using System.Net;
using System.Text;
using System.Text.Json;

namespace Botas.Tests;

public class UserTokenClientTests : IDisposable
{
    private readonly ServiceProvider _serviceProvider;
    private readonly Mock<IAuthorizationHeaderProvider> _mockAuthProvider;
    private readonly Mock<HttpMessageHandler> _mockHttpMessageHandler;
    private readonly UserTokenClient _userTokenClient;
    private readonly string _testScope = "https://api.botframework.com/.default";
    private readonly string _testAuthHeader = "Bearer test-token";

    // Cache the JsonSerializerOptions instance
    private static readonly JsonSerializerOptions _camelCaseOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public UserTokenClientTests()
    {
        // Setup mocks
        _mockAuthProvider = new Mock<IAuthorizationHeaderProvider>();
        _mockHttpMessageHandler = new Mock<HttpMessageHandler>();

        // Setup AuthorizationHeaderProvider mock
        _mockAuthProvider.Setup(a => a.CreateAuthorizationHeaderForAppAsync(It.IsAny<string>(), It.IsAny<AuthorizationHeaderProviderOptions?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(_testAuthHeader);

        // Setup DI container
        ServiceCollection services = new();

        // Add configuration with test data
        Dictionary<string, string?> configurationData = new()
        {
            ["AzureAd:AgentScope"] = _testScope
        };
        IConfigurationRoot configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(configurationData)
            .Build();
        services.AddSingleton<IConfiguration>(configuration);

        // Add logging
        services.AddLogging(builder => builder.AddProvider(NullLoggerProvider.Instance));

        // Add mocked authorization header provider
        services.AddSingleton(_mockAuthProvider.Object);

        // Configure HttpClient with the BotAuthenticationHandler using the mocked primary handler
        services.AddHttpClient("BotFrameworkUserToken")
            .ConfigurePrimaryHttpMessageHandler(() => _mockHttpMessageHandler.Object)
            .AddHttpMessageHandler(sp => new BotAuthenticationHandler(
                sp.GetRequiredService<IAuthorizationHeaderProvider>(),
                sp.GetRequiredService<ILogger<BotAuthenticationHandler>>(),
                _testScope));

        // Add UserTokenClient with the named HttpClient
        services.AddScoped(sp => new UserTokenClient(
            sp.GetRequiredService<ILogger<UserTokenClient>>(),
            sp.GetRequiredService<IHttpClientFactory>().CreateClient("BotFrameworkUserToken")));

        _serviceProvider = services.BuildServiceProvider();
        _userTokenClient = _serviceProvider.GetRequiredService<UserTokenClient>();
    }

    [Fact]
    public async Task GetTokenAsync_WithValidResponse_ReturnsToken()
    {
        // Arrange
        string userId = "test-user";
        string connectionName = "test-connection";
        string channelId = "test-channel";
        string code = "test-code";

        IUserTokenClient.GetTokenResult expectedResponse = new()
        {
            ConnectionName = connectionName,
            Token = "test-token-value"
        };
        string responseJson = JsonSerializer.Serialize(expectedResponse, _camelCaseOptions);

        SetupHttpMessageHandler(HttpStatusCode.OK, responseJson);

        // Act
        IUserTokenClient.GetTokenResult result = await _userTokenClient.GetTokenAsync(userId, connectionName, channelId, code);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(connectionName, result.ConnectionName);
        Assert.Equal("test-token-value", result.Token);

        // Verify the HTTP request was made correctly
        _mockHttpMessageHandler.Protected().Verify(
            "SendAsync",
            Times.AtLeastOnce(),
            ItExpr.IsAny<HttpRequestMessage>(),
            ItExpr.IsAny<CancellationToken>()
        );
    }

    [Fact]
    public async Task GetTokenAsync_WithErrorResponse_ThrowsException()
    {
        // Arrange
        string userId = "test-user";
        string connectionName = "test-connection";
        string channelId = "test-channel";

        SetupHttpMessageHandler(HttpStatusCode.InternalServerError, "Internal server error");

        // Act & Assert
        await Assert.ThrowsAsync<HttpRequestException>(() =>
            _userTokenClient.GetTokenAsync(userId, connectionName, channelId)
        );
    }

    [Fact]
    public async Task GetTokenStatusAsync_WithValidResponse_ReturnsTokenStatus()
    {
        // Arrange
        string userId = "test-user";
        string channelId = "test-channel";

        IUserTokenClient.GetTokenStatusResult[] expectedResponse = [
            new()
            {
                ConnectionName = "connection1",
                HasToken = true,
                ServiceProviderDisplayName = "Azure"
            }
        ];
        string responseJson = JsonSerializer.Serialize(expectedResponse, _camelCaseOptions);

        SetupHttpMessageHandler(HttpStatusCode.OK, responseJson);

        // Act
        IUserTokenClient.GetTokenStatusResult[] result = await _userTokenClient.GetTokenStatusAsync(userId, channelId);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.True(result[0].HasToken);
    }

    [Fact]
    public async Task SignOutUserAsync_WithValidResponse_ReturnsTrue()
    {
        // Arrange
        string userId = "test-user";

        SetupHttpMessageHandler(HttpStatusCode.OK, "");

        // Act
        bool result = await _userTokenClient.SignOutUserAsync(userId);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task SignOutUserAsync_WithErrorResponse_ReturnsFalse()
    {
        // Arrange
        string userId = "test-user";

        SetupHttpMessageHandler(HttpStatusCode.InternalServerError, "Internal error");

        // Act
        bool result = await _userTokenClient.SignOutUserAsync(userId);

        // Assert
        Assert.False(result);
    }

    private void SetupHttpMessageHandler(HttpStatusCode statusCode, string responseContent)
    {
        _mockHttpMessageHandler.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(responseContent, Encoding.UTF8, "application/json")
            });
    }

    public void Dispose()
    {
        _serviceProvider?.Dispose();
    }
}
