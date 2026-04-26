using Botas;
using OpenTelemetry.Trace;

var app = BotApp.Create(args);

// OpenTelemetry setup: captures botas library spans and HTTP instrumentation.
// Exports to OTLP (e.g., Aspire Dashboard at http://localhost:4317) and console.
// For production, replace with Azure Monitor: dotnet add package Azure.Monitor.OpenTelemetry.AspNetCore
// and use: builder.Services.AddOpenTelemetry().UseAzureMonitor();
app.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddSource("botas")
        .AddOtlpExporter()
        .AddConsoleExporter());

app.On("message", async (context, ct) =>
{
    await context.SendAsync($"Echo: {context.Activity.Text}, from aspnet", ct);
});

app.Run();