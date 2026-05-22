using Botas.State;
using Microsoft.Extensions.Logging;

namespace Botas;

/// <summary>
/// Extension methods for BotApplication to register state middleware.
/// </summary>
public static class BotApplicationStateExtensions
{
    /// <summary>
    /// Register state middleware to enable TurnState for all turns.
    /// State is loaded at turn start and saved at turn end (only on successful turns).
    /// </summary>
    /// <param name="app">The BotApplication instance.</param>
    /// <param name="storage">Storage provider for state persistence.</param>
    /// <param name="logger">Optional logger for state middleware diagnostics.</param>
    /// <returns>The BotApplication instance for method chaining.</returns>
    public static BotApplication UseState(this BotApplication app, IStorage storage, ILogger? logger = null)
    {
        var middleware = new StateMiddleware(storage, logger);
        app.Use(middleware);
        return app;
    }
}
