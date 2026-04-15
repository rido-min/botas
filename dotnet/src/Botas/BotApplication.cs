using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using System.Collections;
using System.Text.Json;

namespace Botas;

public class BotHandlerException(string message, Exception ex, CoreActivity activity) : Exception(message, ex)
{
    public CoreActivity Activity { get; } = activity;
}

/// <summary>
/// Response returned by an invoke activity handler.
/// The <see cref="Status"/> is written as the HTTP status code;
/// <see cref="Body"/> is serialized as JSON.
/// </summary>
public class InvokeResponse
{
    /// <summary>HTTP status code to return to the channel (e.g. 200, 400, 501).</summary>
    public int Status { get; set; }
    /// <summary>Optional response body serialized as JSON. Omitted when <c>null</c>.</summary>
    public object? Body { get; set; }
}

public delegate Task NextDelegate(CancellationToken cancellationToken);
public interface ITurnMiddleWare
{
    Task OnTurnAsync(TurnContext context, NextDelegate next, CancellationToken cancellationToken = default);
}

public class BotApplication
{
    private readonly ILogger<BotApplication> _logger;
    private readonly IConfiguration _configuration;
    private ConversationClient? _conversationClient;
    private readonly string _serviceKey;
    private readonly TurnMiddleware _turnMiddleware;
    private readonly Dictionary<string, Func<TurnContext, CancellationToken, Task>> _handlers = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Func<TurnContext, CancellationToken, Task<InvokeResponse>>> _invokeHandlers = new(StringComparer.OrdinalIgnoreCase);

    public BotApplication()
    {
        _logger = NullLogger<BotApplication>.Instance;
        _configuration = new ConfigurationBuilder().Build();
        _serviceKey = "AzureAd";
        _turnMiddleware = new TurnMiddleware();
    }

    public BotApplication(IConfiguration config, ILogger<BotApplication> logger, string serviceKey = "AzureAd")
    {
        _logger = logger;
        _configuration = config;
        _serviceKey = serviceKey;
        _turnMiddleware = new TurnMiddleware();
        logger.LogInformation("Started bot listener on {Port} for AppID:{AppId}", config["ASPNETCORE_URLS"], config[$"{_serviceKey}:ClientId"]);
    }

    internal TurnMiddleware MiddleWare => _turnMiddleware;

    public Func<TurnContext, CancellationToken, Task>? OnActivity { get; set; }

    public string? AppId => _configuration[$"{_serviceKey}:ClientId"];

    /// <summary>
    /// Register a handler for a specific activity type.
    /// Only one handler per type is supported; registering the same type replaces the previous handler.
    /// </summary>
    public BotApplication On(string type, Func<TurnContext, CancellationToken, Task> handler)
    {
        _handlers[type] = handler;
        return this;
    }

    /// <summary>
    /// Register a handler for an invoke activity by its <c>activity.Name</c> sub-type.
    /// The handler must return an <see cref="InvokeResponse"/> — the status and body are
    /// written directly to the HTTP response for invoke activities.
    /// Only one handler per name is supported; registering the same name replaces the previous handler.
    /// </summary>
    public BotApplication OnInvoke(string name, Func<TurnContext, CancellationToken, Task<InvokeResponse>> handler)
    {
        _invokeHandlers[name] = handler;
        return this;
    }

    public async Task<CoreActivity> ProcessAsync(HttpContext httpContext, CancellationToken cancellationToken = default)
    {
        _conversationClient = httpContext.RequestServices.GetKeyedService<ConversationClient>(_serviceKey) ?? throw new InvalidOperationException("ConversationClient not registered");

        CoreActivity activity = await CoreActivity.FromJsonStreamAsync(httpContext.Request.Body, cancellationToken) ?? throw new InvalidOperationException("Invalid Activity");

        if (string.IsNullOrEmpty(activity.Type))
        {
            throw new InvalidOperationException("Activity Type is required");
        }
        if (activity.Conversation?.Id is null)
        {
            throw new InvalidOperationException("Activity Conversation.Id is required");
        }
        if (string.IsNullOrEmpty(activity.ServiceUrl))
        {
            throw new InvalidOperationException("Activity ServiceUrl is required");
        }

        if (_logger.IsEnabled(LogLevel.Trace))
        {
            _logger.LogTrace("Received activity type: {Type}", activity.Type);
        }

        using (_logger.BeginScope("Processing activity {Type}", activity.Type))
        {
            var context = new TurnContext(this, activity);
            InvokeResponse? invokeResponse = null;
            try
            {
                var callback = OnActivity is not null
                    ? (Func<TurnContext, CancellationToken, Task>)((ctx, ct) => OnActivity(ctx, ct))
                    : DispatchToHandler;

                if (string.Equals(activity.Type, "invoke", StringComparison.OrdinalIgnoreCase))
                {
                    Task<InvokeResponse> invokeCallback(TurnContext ctx, CancellationToken ct) => DispatchInvokeHandler(ctx, ct);
                    await _turnMiddleware.RunPipeline(context, async (ctx, ct) =>
                    {
                        invokeResponse = await invokeCallback(ctx, ct).ConfigureAwait(false);
                    }, 0, cancellationToken).ConfigureAwait(false);
                }
                else
                {
                    await _turnMiddleware.RunPipeline(context, callback, 0, cancellationToken).ConfigureAwait(false);
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException)
                {
                    throw;
                }
                if (ex is BotHandlerException)
                {
                    throw;
                }
                _logger.LogError(ex, "Error processing activity {Type}", activity.Type);
                throw new BotHandlerException("Error processing activity", ex, activity);
            }
            finally
            {
                _logger.LogInformation("Finished processing activity {Type}", activity.Type);
            }

            // Write the HTTP response — ProcessAsync owns the full response lifecycle
            if (invokeResponse is not null)
            {
                httpContext.Response.StatusCode = invokeResponse.Status;
                if (invokeResponse.Body is not null)
                {
                    httpContext.Response.ContentType = "application/json";
                    await httpContext.Response.WriteAsync(
                        JsonSerializer.Serialize(invokeResponse.Body, CoreActivity.DefaultJsonOptions),
                        cancellationToken).ConfigureAwait(false);
                }
            }
            else
            {
                httpContext.Response.StatusCode = StatusCodes.Status200OK;
                httpContext.Response.ContentType = "application/json";
                await httpContext.Response.WriteAsync("{}", cancellationToken).ConfigureAwait(false);
            }

            return activity;
        }
    }

    /// <summary>
    /// Register middleware to run before handlers on every turn.
    /// Middleware executes in registration order.
    /// IMPORTANT: Call this method only during application startup, not per-request.
    /// </summary>
    public ITurnMiddleWare Use(ITurnMiddleWare middleware)
    {
        _turnMiddleware.Use(middleware);
        return _turnMiddleware;
    }

    public async Task<string> SendActivityAsync(CoreActivity activity, CancellationToken cancellationToken = default)
    {
        if (_conversationClient is null)
        {
            throw new InvalidOperationException("ConversationClient not initialized");
        }
        return await _conversationClient.SendActivityAsync(activity, cancellationToken);
    }

    private Task DispatchToHandler(TurnContext context, CancellationToken cancellationToken)
    {
        if (_handlers.TryGetValue(context.Activity.Type, out var handler))
        {
            return handler(context, cancellationToken);
        }
        return Task.CompletedTask;
    }

    internal async Task<InvokeResponse> DispatchInvokeHandler(TurnContext context, CancellationToken cancellationToken)
    {
        var name = context.Activity.Name;
        if (name is not null && _invokeHandlers.TryGetValue(name, out var handler))
        {
            try
            {
                return await handler(context, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                throw new BotHandlerException($"Invoke handler for \"{name}\" threw an error", ex, context.Activity);
            }
        }
        return new InvokeResponse { Status = 501 };
    }
}

internal class TurnMiddleware : ITurnMiddleWare, IEnumerable<ITurnMiddleWare>
{

    private readonly IList<ITurnMiddleWare> _middlewares = [];
    internal TurnMiddleware Use(ITurnMiddleWare middleware)
    {
        _middlewares.Add(middleware);
        return this;
    }


    public async Task OnTurnAsync(TurnContext context, NextDelegate next, CancellationToken cancellationToken = default)
    {
        await RunPipeline(context, null!, 0, cancellationToken).ConfigureAwait(false);
        await next(cancellationToken).ConfigureAwait(false);
    }

    public Task RunPipeline(TurnContext context, Func<TurnContext, CancellationToken, Task>? callback, int nextMiddlewareIndex, CancellationToken cancellationToken)
    {
        if (nextMiddlewareIndex == _middlewares.Count)
        {
            if (callback is not null)
            {
                return callback!(context, cancellationToken) ?? Task.CompletedTask;
            }
            else
            {
                return Task.CompletedTask;
            }
        }
        ITurnMiddleWare nextMiddleware = _middlewares[nextMiddlewareIndex];
        return nextMiddleware.OnTurnAsync(
            context,
            (ct) => RunPipeline(context, callback, nextMiddlewareIndex + 1, ct),
            cancellationToken);

    }

    public IEnumerator<ITurnMiddleWare> GetEnumerator()
    {
        return _middlewares.GetEnumerator();
    }

    IEnumerator IEnumerable.GetEnumerator()
    {
        return GetEnumerator();
    }
}
