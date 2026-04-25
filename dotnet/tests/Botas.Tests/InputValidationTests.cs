using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Botas.Tests;

/// <summary>
/// Tests for input validation of required activity fields (#260).
/// Missing or empty required fields should return 400 Bad Request.
/// </summary>
public class InputValidationTests : IAsyncLifetime
{
    private WebApplication? _app;
    private HttpClient? _client;
    private BotApplication? _bot;

    public async Task InitializeAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();

        // Register a keyed ConversationClient so ProcessAsync can resolve it
        builder.Services.AddHttpClient("BotFrameworkNoAuth", client =>
            client.Timeout = TimeSpan.FromSeconds(30));
        builder.Services.AddKeyedScoped<ConversationClient>("AzureAd", (sp, _) =>
            new ConversationClient(
                sp.GetRequiredService<IHttpClientFactory>().CreateClient("BotFrameworkNoAuth"),
                NullLoggerFactory.Instance.CreateLogger<ConversationClient>()));

        _app = builder.Build();

        _bot = new BotApplication(
            new ConfigurationBuilder().Build(),
            NullLogger<BotApplication>.Instance);
        _bot.On("message", (ctx, ct) => Task.CompletedTask);

        _app.UseExceptionHandler(errorApp =>
        {
            errorApp.Run(async context =>
            {
                context.Response.StatusCode = 500;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("{}");
            });
        });
        _app.MapPost("/api/messages", async (HttpContext httpContext, CancellationToken ct) =>
        {
            await _bot.ProcessAsync(httpContext, ct);
        });

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

    private StringContent JsonContent(object obj)
    {
        var json = JsonSerializer.Serialize(obj);
        return new StringContent(json, Encoding.UTF8, "application/json");
    }

    [Fact]
    public async Task NullType_Returns400()
    {
        // Send JSON with explicit null type to bypass the constructor default
        var json = """{"type":null,"serviceUrl":"https://smba.trafficmanager.net/teams/","conversation":{"id":"conv1"}}""";
        var response = await _client!.PostAsync("/api/messages",
            new StringContent(json, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

        string body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("BadRequest", doc.RootElement.GetProperty("error").GetString());
        Assert.Contains("type", doc.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task EmptyType_Returns400()
    {
        var activity = new { type = "", serviceUrl = "https://smba.trafficmanager.net/teams/", conversation = new { id = "conv1" } };
        var response = await _client!.PostAsync("/api/messages", JsonContent(activity));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        string body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("BadRequest", doc.RootElement.GetProperty("error").GetString());
        Assert.Contains("type", doc.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task MissingServiceUrl_Returns400()
    {
        var activity = new { type = "message", conversation = new { id = "conv1" } };
        var response = await _client!.PostAsync("/api/messages", JsonContent(activity));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

        string body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("BadRequest", doc.RootElement.GetProperty("error").GetString());
        Assert.Contains("serviceUrl", doc.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task EmptyServiceUrl_Returns400()
    {
        var activity = new { type = "message", serviceUrl = "", conversation = new { id = "conv1" } };
        var response = await _client!.PostAsync("/api/messages", JsonContent(activity));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        string body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("BadRequest", doc.RootElement.GetProperty("error").GetString());
        Assert.Contains("serviceUrl", doc.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task ValidActivity_DoesNotReturn400()
    {
        var activity = new { type = "message", text = "hello", serviceUrl = "https://smba.trafficmanager.net/teams/", conversation = new { id = "conv1" } };
        var response = await _client!.PostAsync("/api/messages", JsonContent(activity));

        // Should not be 400 — it may be 500 due to missing ConversationClient in this test setup,
        // but importantly it should NOT be 400
        Assert.NotEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
