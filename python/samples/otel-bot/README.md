# OTel Bot — OpenTelemetry Sample

Demonstrates how to add OpenTelemetry observability to a botas Python bot.
Traces, metrics, and logs are exported via OTLP — works with Grafana OTEL-LGTM locally and Azure Monitor in production.

## Install

```bash
pip install -e .
```

## Run

```bash
OTEL_SERVICE_NAME=otel-bot python main.py
```

## Local Development with Grafana OTEL-LGTM

Start the Grafana OTEL-LGTM stack to collect and visualize telemetry locally:

```bash
docker run --rm -d --name lgtm -p 3000:3000 -p 4317:4317 -p 4318:4318 grafana/otel-lgtm
```

Set the OTLP endpoint and run the bot:

```bash
OTEL_SERVICE_NAME=otel-bot \
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 \
python main.py
```

Open <http://localhost:3000> (admin/admin) to view traces (Tempo) and metrics (Mimir).

## Azure Monitor (Production)

Set the Application Insights connection string to export telemetry to Azure Monitor:

```bash
APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=..." \
OTEL_SERVICE_NAME=otel-bot \
python main.py
```

## More Info

See the [Observability spec](../../../specs/observability.md) for full details on tracing, metrics, and dashboard configuration.
