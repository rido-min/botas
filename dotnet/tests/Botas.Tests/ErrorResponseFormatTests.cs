using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Text.Json;
using Xunit;

namespace Botas.Tests;

/// <summary>
/// Tests for standard JSON error response format (#247).
/// All error responses must return Content-Type: application/json with
/// {"error": "ErrorCode", "message": "human-readable description"}.
/// </summary>
public class ErrorResponseFormatTests : IAsyncLifetime
{
    private WebApplication? _app;
    private HttpClient? _client;

    public async Task InitializeAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AzureAd:ClientId"] = "test-client-id",
            ["AzureAd:TenantId"] = "test-tenant-id"
        });
        builder.Services.AddBotApplication<BotApplication>();

        _app = builder.Build();
        _app.UseBotApplication<BotApplication>();
        await _app.StartAsync();

        _client = _app.GetTestClient();
    }

    public async Task DisposeAsync()
    {
        _client?.Dispose();
        if (_app != null)
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }
    }

    [Fact]
    public async Task Post_WithoutAuth_Returns401WithJsonBody()
    {
        var response = await _client!.PostAsync("/api/messages",
            new StringContent("{}", System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

        string body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("Unauthorized", doc.RootElement.GetProperty("error").GetString());
        Assert.Equal("Missing or invalid Authorization header", doc.RootElement.GetProperty("message").GetString());
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    [InlineData("PATCH")]
    public async Task NonPostMethod_Returns405WithJsonBody(string method)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), "/api/messages");
        var response = await _client!.SendAsync(request);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

        string body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("MethodNotAllowed", doc.RootElement.GetProperty("error").GetString());
        Assert.Equal("Only POST is accepted", doc.RootElement.GetProperty("message").GetString());
    }
}
