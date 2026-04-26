using System.Diagnostics;

namespace Botas;

/// <summary>
/// Provides a shared <see cref="ActivitySource"/> for botas OpenTelemetry instrumentation.
/// When no OTel SDK listener is configured, spans are automatically no-ops.
/// </summary>
internal static class BotActivitySource
{
    internal static readonly ActivitySource Source = new(
        "botas",
        typeof(BotApplication).Assembly.GetName().Version?.ToString() ?? "0.0.0");
}
