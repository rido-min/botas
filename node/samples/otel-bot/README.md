# OTel Bot

Echo bot with **OpenTelemetry** observability — traces, metrics, and logs via the
[Microsoft OpenTelemetry distro](https://www.npmjs.com/package/@microsoft/opentelemetry).

## Quick Start

```bash
npm install
npx tsx index.ts
```

## Local Observability with Aspire Dashboard

Run the [Aspire Dashboard](https://learn.microsoft.com/dotnet/aspire/fundamentals/dashboard/standalone) locally:

```bash
docker run -p 4317:4317 -p 18888:18888 mcr.microsoft.com/dotnet/aspire-dashboard:latest
```

Then start the bot with OTLP export:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 OTEL_SERVICE_NAME=otel-bot npx tsx index.ts
```

Open <http://localhost:18888> to view traces, logs, and metrics.

## Azure Monitor (Production)

Set the Application Insights connection string and telemetry is routed automatically:

```bash
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=... npx tsx index.ts
```

No code changes needed — the Microsoft distro detects the env var.

## Further Reading

- [Observability guide](../../docs-site/observability.md)
- [specs/README.md](../../../specs/README.md)
