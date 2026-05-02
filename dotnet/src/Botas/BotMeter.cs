using System.Diagnostics.Metrics;

namespace Botas;

/// <summary>
/// Provides shared <see cref="Meter"/> and metric instruments for botas OpenTelemetry instrumentation.
/// When no OTel SDK listener is configured, metrics are automatically no-ops.
/// </summary>
internal static class BotMeter
{
    internal static readonly Meter Meter = new(
        "botas",
        typeof(BotApplication).Assembly.GetName().Version?.ToString() ?? "0.0.0");

    /// <summary>Counter: total activities received, tagged by activity.type.</summary>
    internal static readonly Counter<long> ActivitiesReceived = Meter.CreateCounter<long>(
        "botas.activities.received",
        unit: "{activity}",
        description: "Total activities received by the bot");

    /// <summary>Histogram: turn processing duration in milliseconds.</summary>
    internal static readonly Histogram<double> TurnDuration = Meter.CreateHistogram<double>(
        "botas.turn.duration",
        unit: "ms",
        description: "Duration of turn processing");

    /// <summary>Counter: handler errors, tagged by activity.type.</summary>
    internal static readonly Counter<long> HandlerErrors = Meter.CreateCounter<long>(
        "botas.handler.errors",
        unit: "{error}",
        description: "Total handler errors");

    /// <summary>Histogram: middleware execution duration in milliseconds.</summary>
    internal static readonly Histogram<double> MiddlewareDuration = Meter.CreateHistogram<double>(
        "botas.middleware.duration",
        unit: "ms",
        description: "Duration of individual middleware execution");

    /// <summary>Counter: outbound API calls to Bot Service.</summary>
    internal static readonly Counter<long> OutboundCalls = Meter.CreateCounter<long>(
        "botas.outbound.calls",
        unit: "{call}",
        description: "Total outbound API calls to Bot Service");

    /// <summary>Counter: outbound API call errors.</summary>
    internal static readonly Counter<long> OutboundErrors = Meter.CreateCounter<long>(
        "botas.outbound.errors",
        unit: "{error}",
        description: "Total outbound API call errors");
}
