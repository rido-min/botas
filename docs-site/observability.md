---
outline: deep
---

# Observability: See What Your Bot Is Doing

botas bots emit telemetry automatically using **OpenTelemetry**. Get distributed traces, metrics, and structured logs without writing observability code. View traces locally during development or send them to Azure Monitor for production.

---

## Overview

botas uses the **Microsoft OpenTelemetry distros** to emit three signals:

- **Traces**: Full request flow through the turn pipeline (auth → middleware → handler → replies)
- **Metrics**: Request rates, latency, token acquisition times, error counts
- **Logs**: Structured logs from the bot runtime, enriched with trace context

**Auto-instrumentation** (included out of the box):
- HTTP server (inbound `POST /api/messages`)
- HTTP client (outbound Bot Service API calls)
- Azure SDK calls
- Database clients (if used by your bot)

**Botas-specific spans** add bot-level semantics on top: activity type, handler dispatch mode, conversation ID, middleware execution, token acquisition, and API calls.

---

## Quick Start

Enable observability in your bot with a single setup call. Choose your language:

::: code-group

```csharp [.NET]
using Botas;
using Microsoft.OpenTelemetry;

var builder = WebApplication.CreateBuilder(args);

// Enable OpenTelemetry
builder.Services.AddOpenTelemetry()
    .UseMicrosoftOpenTelemetry(o =>
    {
        // Auto-detects from environment variables:
        // - APPLICATIONINSIGHTS_CONNECTION_STRING → Azure Monitor
        // - OTEL_EXPORTER_OTLP_ENDPOINT → OTLP collector (Aspire, Jaeger)
        // Defaults to Console if neither is set
    });

var bot = BotApp.Create(builder);
bot.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync("Echo: " + ctx.Activity.Text, ct);
});

await bot.RunAsync();
```

```typescript [Node.js]
// otel-setup.ts — MUST be imported before any other modules
import { useMicrosoftOpenTelemetry } from "@microsoft/opentelemetry";

useMicrosoftOpenTelemetry({
  instrumentationOptions: {
    http: {
      enabled: true,
    },
    azureSdk: {
      enabled: true,
    },
  },
});
```

```typescript [Node.js — index.ts]
import "./otel-setup.js";

import { BotApp } from "botas-express";

const app = new BotApp();
app.on("message", async (ctx) => {
  await ctx.send(`Echo: ${ctx.activity.text}`);
});

app.start();
```

```python [Python]
# main.py — MUST be at the top
from microsoft_opentelemetry import use_microsoft_opentelemetry

# Enable OpenTelemetry first
use_microsoft_opentelemetry()

# Now import the bot
from botas_fastapi import BotApp

bot = BotApp()

@bot.on("message")
async def on_message(ctx):
    await ctx.send(f"Echo: {ctx.activity.text}")

app = bot.start()
```

:::

That's it. Traces are now being emitted.

---

## Viewing Traces Locally

Use **Aspire Dashboard** to see traces in real-time during development.

### 1. Run Aspire Dashboard

```bash
docker run -p 4317:4317 -p 18888:18888 \
  mcr.microsoft.com/dotnet/aspire-dashboard:latest
```

### 2. Point your bot to the dashboard

Set the environment variable before starting your bot:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

Or add to your `.env` file:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

### 3. Open the dashboard

Open [http://localhost:18888](http://localhost:18888) in your browser.

### 4. Send a message to your bot

Every message will appear in the dashboard as a trace. Click on any trace to see:

- **Spans**: Each operation (HTTP request, middleware, handler, API call)
- **Attributes**: Key-value pairs like `activity.type`, `conversation.id`, `user.id`
- **Timings**: How long each operation took
- **Errors**: Exceptions and stack traces (if any)

---

## Understanding Botas-Specific Spans

On top of auto-instrumented HTTP and database spans, botas emits these custom spans to provide bot-level context:

| Span Name | What It Measures | When | Key Attributes |
|-----------|------------------|------|-----------------|
| `botas.turn` | Full message processing (auth → reply) | Start: activity received, End: response sent | `activity.type`, `activity.id`, `conversation.id`, `bot.id` |
| `botas.middleware` | Single middleware execution | Start: before middleware, End: after `next()` | `middleware.name`, `middleware.index` |
| `botas.handler` | Handler dispatch and execution | Start: before handler, End: after return | `handler.type`, `handler.dispatch` |
| `botas.auth.inbound` | JWT validation of incoming request | Start: validation begins, End: signature verified | `auth.issuer`, `auth.audience`, `auth.key_id` |
| `botas.auth.outbound` | OAuth2 token acquisition | Start: before token request, End: token acquired or cached | `auth.token_endpoint`, `auth.scope`, `auth.cache_hit` |
| `botas.conversation_client` | Bot Service API call (send activity) | Start: before API call, End: response received | `conversation.id`, `activity.type`, `service.url` |

**Example trace hierarchy** (from Aspire Dashboard):

```
POST /api/messages (auto-instrumented HTTP)
  └─ botas.turn (message received)
      ├─ botas.auth.inbound (JWT validated)
      ├─ botas.middleware[0] (LoggingMiddleware)
      └─ botas.handler (handler dispatched)
          └─ botas.conversation_client (send reply)
              ├─ botas.auth.outbound (token acquired)
              └─ POST v3/conversations/.../activities (auto-instrumented HTTP)
```

---

## Production Setup: Azure Monitor

For production bots, send telemetry to **Azure Monitor (Application Insights)**:

### 1. Create an Application Insights resource

In Azure Portal:
1. Create a new **Application Insights** resource
2. Copy the **Connection String**

### 2. Set the environment variable

```bash
export APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=...;IngestionEndpoint=..."
```

Or add to your `.env` / deployment secrets:

```
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...;IngestionEndpoint=...
```

### 3. Configure sampling (optional)

To reduce telemetry volume in production, enable sampling:

```bash
export OTEL_TRACES_SAMPLER=traceidratio
export OTEL_TRACES_SAMPLER_ARG=0.1  # Sample 10% of traces
```

### 4. Add deployment context (optional)

Enrich traces with deployment information:

```bash
export OTEL_SERVICE_NAME=my-teams-bot
export OTEL_RESOURCE_ATTRIBUTES="deployment.environment=production,service.version=1.2.3"
```

Now all traces are exported to Application Insights. Use the built-in dashboards, analytics queries, and alerting.

---

## Language-Specific Differences

Most observability features work the same across .NET, Node.js, and Python. Here are the intentional differences:

| Feature | .NET | Node.js | Python |
|---------|------|---------|--------|
| **Setup location** | After `CreateBuilder()`, before `Build()` | **Before any imports** at top of entry point | **Before any imports** at top of entry point |
| **Configuration method** | `ExportTarget` enum flags | Env vars only | `enable_azure_monitor=True`, `enable_console=True`, or env vars |
| **Rate limiting** | Not supported | Not supported | Not supported |
| **Disable signals** | Not supported (all enabled) | Not supported (all enabled) | `disable_tracing=True`, `disable_metrics=True`, `disable_logging=True` |
| **Sampling config** | `OTEL_TRACES_SAMPLER_ARG` env var | `OTEL_TRACES_SAMPLER_ARG` env var | `OTEL_TRACES_SAMPLER_ARG` env var |

For full language-specific details, see the [Observability spec](https://github.com/rido-min/botas/blob/main/specs/observability.md).

---

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `OTEL_SERVICE_NAME` | Service name in telemetry | `"teams-support-bot"` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Azure Monitor connection string | `"InstrumentationKey=...;IngestionEndpoint=..."` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint (Aspire, Jaeger) | `"http://localhost:4317"` |
| `OTEL_TRACES_SAMPLER` | Sampling strategy | `"traceidratio"` (default: `"always_on"`) |
| `OTEL_TRACES_SAMPLER_ARG` | Sampling parameter (ratio) | `"0.1"` (10%) |
| `OTEL_RESOURCE_ATTRIBUTES` | Resource context (tags) | `"deployment.environment=production,service.version=1.0.0"` |

---

## Next Steps

- **Aspire Dashboard docs**: [Microsoft Aspire documentation](https://learn.microsoft.com/dotnet/aspire/)
- **Azure Monitor**: [Application Insights documentation](https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-enable)
- **OpenTelemetry spec**: [OpenTelemetry documentation](https://opentelemetry.io/docs/)
- **Full technical spec**: [specs/observability.md](https://github.com/rido-min/botas/blob/main/specs/observability.md)
