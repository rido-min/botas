# OTel Bot — OpenTelemetry Sample

Demonstrates how to add OpenTelemetry observability to a botas Python bot.
Traces, metrics, and logs are exported via OTLP — works with the Aspire Dashboard locally and Azure Monitor in production.

## Install

```bash
pip install -e .
```

## Run

```bash
OTEL_SERVICE_NAME=otel-bot python main.py
```

## Local Development with Aspire Dashboard

Start the Aspire Dashboard to collect and visualize telemetry locally:

```bash
docker run -p 4317:4317 -p 18888:18888 mcr.microsoft.com/dotnet/aspire-dashboard:latest
```

Set the OTLP endpoint and run the bot:

```bash
OTEL_SERVICE_NAME=otel-bot \
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 \
python main.py
```

Open <http://localhost:18888> to view traces and metrics.

## Azure Monitor (Production)

Set the Application Insights connection string to export telemetry to Azure Monitor:

```bash
APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=..." \
OTEL_SERVICE_NAME=otel-bot \
python main.py
```

## More Info

See the [Observability docs](../../docs-site/observability.md) for full details on tracing, metrics, and dashboard configuration.
