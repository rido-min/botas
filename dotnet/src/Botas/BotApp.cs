using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace Botas;

/// <summary>
/// Zero-boilerplate bot host that wraps ASP.NET Core setup.
/// <para>
/// <example>
/// <code>
/// var app = BotApp.Create(args);
/// app.On("message", async (ctx, ct) =&gt;
///     await ctx.SendAsync($"Echo: {ctx.Activity.Text}", ct));
/// app.Run();
/// </code>
/// </example>
/// </para>
/// </summary>
public class BotApp
{
    private readonly WebApplicationBuilder _builder;
    private WebApplication? _webApp;

    /// <summary>The underlying BotApplication instance (available after <see cref="Run"/>).</summary>
    public BotApplication? Bot { get; private set; }

    private readonly string _routePath;

    private BotApp(string[]? args, string routePath)
    {
        _builder = WebApplication.CreateSlimBuilder(args ?? []);
        _builder.Services.AddBotApplication<BotApplication>();
        _routePath = routePath;
    }

    /// <summary>
    /// Create a new BotApp with default settings.
    /// </summary>
    /// <param name="args">Command-line arguments (passed to <c>WebApplication.CreateSlimBuilder</c>).</param>
    /// <param name="routePath">Route path for the messages endpoint (default: <c>"api/messages"</c>).</param>
    public static BotApp Create(string[]? args = null, string routePath = "api/messages")
    {
        return new BotApp(args, routePath);
    }

    /// <summary>
    /// Register a handler for a specific activity type.
    /// Delegates to <see cref="BotApplication.On"/>.
    /// </summary>
    public BotApp On(string type, Func<TurnContext, CancellationToken, Task> handler)
    {
        // Store handlers to wire up after Build()
        _pendingHandlers.Add((type, handler));
        return this;
    }

    private readonly List<(string type, Func<TurnContext, CancellationToken, Task> handler)> _pendingHandlers = [];

    /// <summary>
    /// Build, configure, and run the bot web application.
    /// This is a blocking call that runs until the application is shut down.
    /// </summary>
    public void Run()
    {
        _webApp = _builder.Build();
        Bot = _webApp.UseBotApplication<BotApplication>(_routePath);

        foreach (var (type, handler) in _pendingHandlers)
        {
            Bot.On(type, handler);
        }

        _webApp.MapGet("/", () => Results.Ok($"Bot {Bot.AppId} Running"));
        _webApp.Run();
    }
}
