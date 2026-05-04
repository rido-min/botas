# 05 - Observability (AI + OpenTelemetry)

AI bot with full OpenTelemetry observability — traces AI calls, HTTP, and logs.

## How it works

- Uses `Microsoft.Extensions.AI` with `.UseOpenTelemetry()` to trace AI calls
- Uses the Microsoft OpenTelemetry distro for single-call onboarding
- Auto-instruments HTTP server/client and Azure SDK calls
- Exports to OTLP (Grafana LGTM, Jaeger, Aspire Dashboard) or Azure Monitor
- Maintains per-conversation chat history

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | API key |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name (default: `gpt-4o`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint (e.g., `http://localhost:4317`) |
| `OTEL_SERVICE_NAME` | Service name for traces (default: app name) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Azure Monitor connection string (optional) |

## Run

```bash
cd dotnet && dotnet run --project samples/05-observability
```

## View Traces Locally

Run Grafana LGTM:
```bash
docker run --rm -d --name lgtm -p 3000:3000 -p 4317:4317 -p 4318:4318 grafana/otel-lgtm
```
Then open http://localhost:3000 (admin/admin).
