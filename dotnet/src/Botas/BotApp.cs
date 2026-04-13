using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

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
    private readonly bool _hasAuth;

    /// <summary>The underlying BotApplication instance (available after <see cref="Run"/>).</summary>
    public BotApplication? Bot { get; private set; }

    private readonly string _routePath;

    private BotApp(string[]? args, string routePath)
    {
        _builder = WebApplication.CreateSlimBuilder(args ?? []);
        _builder.Services.Configure<KestrelServerOptions>(options =>
        {
            options.Limits.MaxRequestBodySize = 1_048_576; // 1 MB
        });
        _routePath = routePath;

        string? clientId = _builder.Configuration["AzureAd:ClientId"];
        if (!string.IsNullOrEmpty(clientId))
        {
            _builder.Services.AddBotApplication<BotApplication>();
            _hasAuth = true;
        }
        else
        {
            // No credentials — run without auth (matches Node/Python BotApp behavior)
            _builder.Services.AddHttpClient("BotFrameworkNoAuth", client =>
                client.Timeout = TimeSpan.FromSeconds(30));
            _builder.Services.AddSingleton<BotApplication>(sp =>
                new BotApplication(
                    sp.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>(),
                    sp.GetRequiredService<ILogger<BotApplication>>()));
            _builder.Services.AddKeyedScoped<ConversationClient>("AzureAd", (sp, _) =>
                new ConversationClient(
                    sp.GetRequiredService<IHttpClientFactory>().CreateClient("BotFrameworkNoAuth"),
                    NullLoggerFactory.Instance.CreateLogger<ConversationClient>()));
            _hasAuth = false;
        }
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

    /// <summary>
    /// Register a handler for an invoke activity by its <c>activity.Name</c> sub-type.
    /// Delegates to <see cref="BotApplication.OnInvoke"/>.
    /// </summary>
    public BotApp OnInvoke(string name, Func<TurnContext, CancellationToken, Task<InvokeResponse>> handler)
    {
        _pendingInvokeHandlers.Add((name, handler));
        return this;
    }

    private readonly List<(string type, Func<TurnContext, CancellationToken, Task> handler)> _pendingHandlers = [];
    private readonly List<ITurnMiddleWare> _pendingMiddlewares = [];
    private readonly List<(string name, Func<TurnContext, CancellationToken, Task<InvokeResponse>> handler)> _pendingInvokeHandlers = [];

    /// <summary>
    /// Register middleware to run before handlers on every turn.
    /// Middleware executes in registration order.
    /// </summary>
    public BotApp Use(ITurnMiddleWare middleware)
    {
        _pendingMiddlewares.Add(middleware);
        return this;
    }

    /// <summary>
    /// Build, configure, and run the bot web application.
    /// This is a blocking call that runs until the application is shut down.
    /// </summary>
    public void Run()
    {
        _webApp = _builder.Build();

        if (_hasAuth)
        {
            Bot = _webApp.UseBotApplication<BotApplication>(_routePath);
        }
        else
        {
            // #102: Add exception handler middleware for unauthenticated path
            _webApp.UseExceptionHandler(errorApp =>
            {
                errorApp.Run(async context =>
                {
                    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsync("{}");
                });
            });
            Bot = _webApp.Services.GetRequiredService<BotApplication>();
            _webApp.MapPost(_routePath, async (HttpContext httpContext, CancellationToken ct) =>
            {
                await Bot.ProcessAsync(httpContext, ct);
                return Results.Ok();
            });
        }

        foreach (var mw in _pendingMiddlewares)
        {
            Bot.Use(mw);
        }

        foreach (var (type, handler) in _pendingHandlers)
        {
            Bot.On(type, handler);
        }

        foreach (var (name, handler) in _pendingInvokeHandlers)
        {
            Bot.OnInvoke(name, handler);
        }

        _webApp.MapGet("/health", () => Results.Ok(new { status = "ok" }));
        _webApp.MapGet("/", () => Results.Ok($"Bot {Bot.AppId} Running"));
        _webApp.Run();
    }
}
