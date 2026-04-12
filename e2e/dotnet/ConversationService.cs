using Botas.Schema;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Botas.E2ETests;

/// <summary>
/// A real HTTP listener that acts as a fake Bot Framework channel service.
/// Captures outbound SendActivity payloads from ConversationClient via TaskCompletionSource.
/// </summary>
public sealed class ConversationService : IAsyncDisposable
{
    private readonly WebApplication _app;
    private TaskCompletionSource<CoreActivity>? _tcs;

    public string BaseUrl { get; private set; } = string.Empty;

    public ConversationService()
    {
        WebApplicationBuilder builder = WebApplication.CreateSlimBuilder();
        _app = builder.Build();

        // Capture 'this' in the route handler so the TCS can be resolved on each call
        _app.MapPost("v3/conversations/{conversationId}/activities", async (HttpContext ctx) =>
        {
            CoreActivity? activity = await CoreActivity.FromJsonStreamAsync(ctx.Request.Body);
            _tcs?.TrySetResult(activity!);
            return Results.Ok(new { id = "test-activity-id" });
        });

        _app.Urls.Add("http://127.0.0.1:0");
    }

    public async Task StartAsync()
    {
        await _app.StartAsync();

        // _app.Urls still shows the "0" placeholder after StartAsync.
        // IServerAddressesFeature contains the actual OS-assigned port.
        IServerAddressesFeature addresses = _app.Services
            .GetRequiredService<IServer>()
            .Features
            .Get<IServerAddressesFeature>()!;

        BaseUrl = addresses.Addresses.First().TrimEnd('/') + "/";
    }

    /// <summary>
    /// Returns a task that completes when the bot next POSTs an activity to this service.
    /// Call this before sending a request to the bot to avoid a race condition.
    /// </summary>
    public Task<CoreActivity> WaitForActivityAsync(TimeSpan? timeout = null)
    {
        _tcs = new TaskCompletionSource<CoreActivity>(TaskCreationOptions.RunContinuationsAsynchronously);
        return _tcs.Task.WaitAsync(timeout ?? TimeSpan.FromSeconds(5));
    }

    public async ValueTask DisposeAsync() => await _app.DisposeAsync();
}
