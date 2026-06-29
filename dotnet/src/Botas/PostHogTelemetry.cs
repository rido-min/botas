using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace Botas;

/// <summary>
/// Internal PostHog telemetry client for usage tracking.
/// Disabled by default; enabled when POSTHOG_API_KEY environment variable is set.
/// All calls are fire-and-forget; failures never affect bot processing.
/// </summary>
internal static class PostHogTelemetry
{
    private static bool _initialized;
    private static bool _isEnabled;
    private static object? _posthogClient;
    private static readonly object _lock = new();
    private static bool _botStartedEmitted;
    private static string? _distinctId;

    /// <summary>
    /// Tracks an event with PostHog (fire-and-forget). Returns immediately if telemetry is disabled.
    /// </summary>
    internal static void TrackEvent(string eventName, Dictionary<string, object> properties)
    {
        if (!EnsureInitialized())
        {
            return; // Telemetry disabled or unavailable
        }

        // Fire-and-forget: run on thread pool, swallow all exceptions
        _ = Task.Run(() =>
        {
            try
            {
                InvokeCapture(eventName, properties);
            }
            catch
            {
                // Silently swallow — telemetry must never affect bot processing
            }
        });
    }

    /// <summary>
    /// Emits the bot_started event once per process lifetime.
    /// </summary>
    internal static void TrackBotStarted(BotApplication app)
    {
        if (_botStartedEmitted)
        {
            return;
        }
        _botStartedEmitted = true;

        var properties = GetCommonProperties();
        properties["handler_count"] = CountHandlers(app);
        properties["invoke_handler_count"] = CountInvokeHandlers(app);
        properties["middleware_count"] = CountMiddleware(app);
        properties["has_catch_all"] = app.OnActivity != null;
        properties["has_state_storage"] = false; // State storage detection is complex; default false for now
        properties["auth_flow"] = DetermineAuthFlow(app);

        TrackEvent("botas/bot_started", properties);
    }

    /// <summary>
    /// Emits activity_received event.
    /// </summary>
    internal static void TrackActivityReceived(string activityType, bool hasHandler, string channelId)
    {
        var properties = GetCommonProperties();
        properties["activity_type"] = activityType;
        properties["has_handler"] = hasHandler;
        properties["channel_type"] = SanitizeChannelType(channelId);

        TrackEvent("botas/activity_received", properties);
    }

    /// <summary>
    /// Emits handler_dispatched event.
    /// </summary>
    internal static void TrackHandlerDispatched(string activityType, string dispatchMode, long durationMs)
    {
        var properties = GetCommonProperties();
        properties["activity_type"] = activityType;
        properties["dispatch_mode"] = dispatchMode;
        properties["duration_ms"] = durationMs;

        TrackEvent("botas/handler_dispatched", properties);
    }

    /// <summary>
    /// Emits handler_error event.
    /// </summary>
    internal static void TrackHandlerError(string activityType, string errorType)
    {
        var properties = GetCommonProperties();
        properties["activity_type"] = activityType;
        properties["error_type"] = errorType;

        TrackEvent("botas/handler_error", properties);
    }

    /// <summary>
    /// Emits outbound_sent event.
    /// </summary>
    internal static void TrackOutboundSent(string operation, bool success)
    {
        var properties = GetCommonProperties();
        properties["operation"] = operation;
        properties["success"] = success;

        TrackEvent("botas/outbound_sent", properties);
    }

    private static bool EnsureInitialized()
    {
        if (_initialized)
        {
            return _isEnabled;
        }

        lock (_lock)
        {
            if (_initialized)
            {
                return _isEnabled;
            }

            _initialized = true;

            // Read environment variables
            string? apiKey = Environment.GetEnvironmentVariable("POSTHOG_API_KEY");
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _isEnabled = false;
                return false;
            }

            string host = Environment.GetEnvironmentVariable("POSTHOG_HOST") ?? "https://us.i.posthog.com";

            // Try to load PostHog SDK via reflection
            try
            {
                // Check if PostHog assembly is available
                var assembly = AppDomain.CurrentDomain.GetAssemblies()
                    .FirstOrDefault(a => a.GetName().Name == "PostHog");

                if (assembly == null)
                {
                    // Try to load it
                    try
                    {
                        assembly = System.Reflection.Assembly.Load("PostHog");
                    }
                    catch
                    {
                        _isEnabled = false;
                        return false;
                    }
                }

                // Create client instance: new PostHogClient(apiKey, host)
                var clientType = assembly.GetType("PostHog.PostHogClient");
                if (clientType == null)
                {
                    _isEnabled = false;
                    return false;
                }

                // Create client instance: new PostHogClient(apiKey, host)
                _posthogClient = Activator.CreateInstance(clientType, apiKey, host);
                if (_posthogClient == null)
                {
                    _isEnabled = false;
                    return false;
                }

                // Compute distinct_id from CLIENT_ID
                string? clientId = Environment.GetEnvironmentVariable("CLIENT_ID");
                _distinctId = ComputeDistinctId(clientId);

                _isEnabled = true;
            }
            catch
            {
                _isEnabled = false;
            }

            return _isEnabled;
        }
    }

    private static void InvokeCapture(string eventName, Dictionary<string, object> properties)
    {
        if (_posthogClient == null || _distinctId == null)
        {
            return;
        }

        try
        {
            // Call: _posthogClient.Capture(distinctId, eventName, properties)
            var captureMethod = _posthogClient.GetType().GetMethod("Capture", 
                new[] { typeof(string), typeof(string), typeof(Dictionary<string, object>) });

            if (captureMethod != null)
            {
                captureMethod.Invoke(_posthogClient, new object[] { _distinctId, eventName, properties });
            }
        }
        catch
        {
            // Silently swallow
        }
    }

    private static Dictionary<string, object> GetCommonProperties()
    {
        return new Dictionary<string, object>
        {
            ["sdk_language"] = "dotnet",
            ["sdk_version"] = BotApplication.Version,
            ["runtime_version"] = GetRuntimeVersion()
        };
    }

    private static string GetRuntimeVersion()
    {
        var version = RuntimeInformation.FrameworkDescription;
        // Example: ".NET 10.0.0" → ".NET 10.0"
        return version.Contains(' ') ? version : $".NET {Environment.Version.Major}.{Environment.Version.Minor}";
    }

    private static string ComputeDistinctId(string? clientId)
    {
        if (string.IsNullOrWhiteSpace(clientId))
        {
            return "botas-anonymous";
        }

        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(clientId));
        string hex = Convert.ToHexStringLower(hash);
        return hex[..16]; // First 16 hex chars
    }

    private static string SanitizeChannelType(string? channelId)
    {
        if (string.IsNullOrWhiteSpace(channelId))
        {
            return "other";
        }

        string lower = channelId.ToLowerInvariant();
        return lower switch
        {
            "emulator" => "emulator",
            "msteams" => "msteams",
            "webchat" => "webchat",
            _ => "other"
        };
    }

    private static int CountHandlers(BotApplication app)
    {
        // Use reflection to count handlers in _handlers dictionary
        var field = typeof(BotApplication).GetField("_handlers", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        if (field?.GetValue(app) is not System.Collections.IDictionary handlers)
        {
            return 0;
        }
        return handlers.Count;
    }

    private static int CountInvokeHandlers(BotApplication app)
    {
        var field = typeof(BotApplication).GetField("_invokeHandlers", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        if (field?.GetValue(app) is not System.Collections.IDictionary invokeHandlers)
        {
            return 0;
        }
        return invokeHandlers.Count;
    }

    private static int CountMiddleware(BotApplication app)
    {
        var middlewareProperty = typeof(BotApplication).GetProperty("MiddleWare",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        if (middlewareProperty?.GetValue(app) is not IEnumerable<ITurnMiddleWare> middleware)
        {
            return 0;
        }
        return middleware.Count();
    }

    private static string DetermineAuthFlow(BotApplication app)
    {
        // For now, assume client_credentials if AppId is set, otherwise "none"
        string? appId = app.AppId;
        if (string.IsNullOrWhiteSpace(appId))
        {
            return "none";
        }
        return "client_credentials";
    }

    /// <summary>
    /// Best-effort flush on shutdown. Called from AppDomain.ProcessExit if needed.
    /// </summary>
    internal static void Shutdown()
    {
        if (!_isEnabled || _posthogClient == null)
        {
            return;
        }

        try
        {
            // Call Flush() if available
            var flushMethod = _posthogClient.GetType().GetMethod("Flush");
            flushMethod?.Invoke(_posthogClient, null);
        }
        catch
        {
            // Silently swallow
        }
    }
}
