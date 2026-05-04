# 05 - Observability (OpenTelemetry)

Echo bot with OpenTelemetry observability — traces, metrics, and structured logs.

## How it works

- Uses `@microsoft/opentelemetry` for auto-instrumentation setup
- Initializes OTel before other imports so HTTP/Azure SDK are auto-patched
- Integrates with botas-core's configurable logger via `createOtelLogger()`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint (e.g., `http://localhost:4317`) |
| `OTEL_SERVICE_NAME` | Service name for traces (default: `otel-bot`) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Azure Monitor connection string (optional) |

## Run

```bash
cd node && npx tsx samples/05-observability/index.ts
```

## View Traces Locally

Run the Aspire Dashboard:
```bash
docker run -p 4317:4317 -p 18888:18888 mcr.microsoft.com/dotnet/aspire-dashboard:latest
```
Then open http://localhost:18888.
