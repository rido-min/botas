# 05 - Observability (AI + OpenTelemetry)

AI bot with OpenTelemetry observability — traces AI calls, HTTP, and structured logs.

## How it works

- Uses `microsoft-opentelemetry` distro for single-call OTel setup
- Must initialize before other imports for auto-instrumentation
- Custom OTel spans wrap LangChain LLM calls with token usage attributes
- Bridges Python logging to OTel LoggerProvider
- Exports to OTLP (Grafana LGTM, Jaeger) or Azure Monitor
- Maintains per-conversation chat history

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | API key |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name (default: `gpt-4o`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint (e.g., `http://localhost:4317`) |
| `OTEL_SERVICE_NAME` | Service name for traces (default: `otel-bot`) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Azure Monitor connection string (optional) |

## Run

```bash
cd python/samples/05-observability && python main.py
```

## View Traces Locally

Run Grafana LGTM:
```bash
docker run --rm -d --name lgtm -p 3000:3000 -p 4317:4317 -p 4318:4318 grafana/otel-lgtm
```
Then open http://localhost:3000 (admin/admin).
