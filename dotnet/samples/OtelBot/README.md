# OtelBot — OpenTelemetry Sample

Demonstrates how to add distributed tracing to a botas bot using [OpenTelemetry](https://opentelemetry.io/).

## What This Sample Shows

- Capturing `botas` library spans with `AddSource("botas")`
- Exporting traces to an OTLP collector (Aspire Dashboard) and to the console

## Running Locally with Aspire Dashboard

1. Start the Aspire Dashboard:

   ```bash
   docker run --rm -it -d -p 18888:18888 -p 4317:18889 --name aspire-dashboard \
     mcr.microsoft.com/dotnet/aspire-dashboard:9.0
   ```

2. Run the bot:

   ```bash
   dotnet run
   ```

3. Open <http://localhost:18888> to view traces.

## Production: Azure Monitor

Replace the OTLP/console exporters with Azure Monitor:

```bash
dotnet add package Azure.Monitor.OpenTelemetry.AspNetCore
```

Then change the OpenTelemetry setup in `Program.cs` to:

```csharp
app.Services.AddOpenTelemetry().UseAzureMonitor();
```

## Further Reading

- [Observability docs](../../../docs-site/observability.md)
- [OpenTelemetry .NET docs](https://opentelemetry.io/docs/languages/dotnet/)
