# 05 - Observability (AI + OpenTelemetry)

AI bot with OpenTelemetry observability — traces LangChain LLM calls, HTTP, and Azure SDK.

## How it works

- Uses `@microsoft/opentelemetry` for auto-instrumentation setup
- Initializes OTel before other imports so HTTP/Azure SDK/LangChain are auto-patched
- Custom `LangChainOtelCallbackHandler` bridges LangChain lifecycle events to OTel spans
- Records token usage (prompt, completion, total) as span attributes
- Maintains per-conversation chat history

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | API key |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name (default: `gpt-4o`) |
| `OPENAI_API_VERSION` | API version (default: `2024-06-01`) |
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
