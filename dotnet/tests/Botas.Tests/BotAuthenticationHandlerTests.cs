using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Identity.Abstractions;
using Moq;
using Moq.Protected;
using Botas.Hosting;
using System.Net;
using System.Text;

namespace Botas.Tests;

public class BotAuthenticationHandlerTests : IDisposable
{
    private readonly ServiceProvider _serviceProvider;
    private readonly Mock<IAuthorizationHeaderProvider> _mockAuthProvider;
    private readonly Mock<HttpMessageHandler> _mockInnerHandler;
    private readonly string _testScope = "https://api.botframework.com/.default";
    private readonly string _testAuthHeader = "Bearer test-token-value";

    public BotAuthenticationHandlerTests()
    {
        // Setup mocks
        _mockAuthProvider = new Mock<IAuthorizationHeaderProvider>();
        _mockInnerHandler = new Mock<HttpMessageHandler>();

        // Setup AuthorizationHeaderProvider mock to return token for app-only authentication
        _mockAuthProvider.Setup(a => a.CreateAuthorizationHeaderForAppAsync(It.IsAny<string>(), It.IsAny<AuthorizationHeaderProviderOptions?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(_testAuthHeader);

        // Setup inner handler to return success
        _mockInnerHandler.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
            });

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

        _serviceProvider = services.BuildServiceProvider();
    }

    [Fact]
    public async Task SendAsync_AcquiresAppOnlyToken()
    {
        // Arrange
        IAuthorizationHeaderProvider authProvider = _serviceProvider.GetRequiredService<IAuthorizationHeaderProvider>();
        ILogger<BotAuthenticationHandler> logger = _serviceProvider.GetRequiredService<ILogger<BotAuthenticationHandler>>();
        BotAuthenticationHandler handler = new(authProvider, logger, _testScope)
        {
            InnerHandler = _mockInnerHandler.Object
        };
        HttpClient client = new(handler);

        // Act
        HttpResponseMessage response = await client.GetAsync("https://api.example.com/test");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _mockAuthProvider.Verify(a => a.CreateAuthorizationHeaderForAppAsync(_testScope, It.IsAny<AuthorizationHeaderProviderOptions?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendAsync_AddsAuthorizationHeader()
    {
        // Arrange
        IAuthorizationHeaderProvider authProvider = _serviceProvider.GetRequiredService<IAuthorizationHeaderProvider>();
        ILogger<BotAuthenticationHandler> logger = _serviceProvider.GetRequiredService<ILogger<BotAuthenticationHandler>>();
        BotAuthenticationHandler handler = new(authProvider, logger, _testScope)
        {
            InnerHandler = _mockInnerHandler.Object
        };
        HttpClient client = new(handler);

        // Act
        HttpResponseMessage response = await client.GetAsync("https://api.example.com/test");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _mockInnerHandler.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req => req.Headers.Authorization != null && req.Headers.Authorization.Scheme == "Bearer"),
            ItExpr.IsAny<CancellationToken>()
        );
    }

    public void Dispose()
    {
        _serviceProvider?.Dispose();
    }
}
