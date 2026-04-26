using Botas;
using OpenTelemetry.Trace;

var app = BotApp.Create(args);

// OpenTelemetry setup: captures botas library spans and HTTP instrumentation.
// Exports to OTLP (e.g., Aspire Dashboard at http://localhost:4317) and console.
//
// To run Aspire Dashboard locally:
//   docker run --rm -it -d -p 18888:18888 -p 4317:18889 --name aspire-dashboard \
//     mcr.microsoft.com/dotnet/aspire-dashboard:9.0
//   Then open http://localhost:18888 to view traces.
//
// For production with Azure Monitor, replace the exporters below:
//   dotnet add package Azure.Monitor.OpenTelemetry.AspNetCore
//   app.Services.AddOpenTelemetry().UseAzureMonitor();
app.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddSource("botas")
        .AddOtlpExporter()
        .AddConsoleExporter());

app.On("message", async (context, ct) =>
{
    await context.SendAsync($"Echo: {context.Activity.Text}", ct);
});

app.Run();
