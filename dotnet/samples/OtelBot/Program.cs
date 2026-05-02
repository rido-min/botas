using Botas;
using Microsoft.OpenTelemetry;
using OpenTelemetry;

var app = BotApp.Create(args);

// OpenTelemetry setup via Microsoft distro — single-call onboarding.
// Auto-instruments HTTP server/client, Azure SDK, and exports based on env vars:
//   - OTEL_EXPORTER_OTLP_ENDPOINT → OTLP collector (Grafana LGTM, Jaeger, Aspire Dashboard)
//   - APPLICATIONINSIGHTS_CONNECTION_STRING → Azure Monitor
//   - Defaults to Console if neither is set
//
// To run Grafana LGTM locally:
//   docker run --rm -d --name lgtm -p 3000:3000 -p 4317:4317 -p 4318:4318 grafana/otel-lgtm
//   set OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
//   Then open http://localhost:3000 (admin/admin) to view traces and metrics.

app.Builder.Logging.AddOpenTelemetry(o => o.IncludeFormattedMessage = true);
app.Services.AddOpenTelemetry()
    .UseMicrosoftOpenTelemetry(o =>
    {
        o.Exporters = ExportTarget.Otlp;
    })
    .WithTracing(t => t.AddSource("botas"))
    .WithMetrics(m => m.AddMeter("botas"));

app.On("message", (context, ct) 
    => context.SendAsync($"Echo: {context.Activity.Text}", ct));


app.Run();
