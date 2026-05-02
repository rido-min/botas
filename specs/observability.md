# Observability Spec

**Purpose**: Define how bots emit telemetry using OpenTelemetry for distributed tracing, metrics, and logging.
**Status**: Draft

---

## Overview

Observability in botas is built on **OpenTelemetry** using the Microsoft OpenTelemetry distros. These distros provide single-call onboarding, automatic instrumentation for HTTP/database/Azure SDK, and export to Azure Monitor (Application Insights), OTLP collectors (Jaeger, Grafana, Aspire Dashboard), or the console for development.

**Three signals**:

- **Traces**: Distributed request flow through the turn pipeline (auth → middleware → handler → outbound calls)
- **Metrics**: Request rates, latency distributions, token acquisition times, error counts
- **Logs**: Structured logs from the bot runtime, enriched with trace context

**Auto-instrumentation** (included):

- HTTP server (inbound `POST /api/messages`)
- HTTP client (outbound ConversationClient calls to Bot Service API)
- Azure SDK calls
- Database clients (if used by bot logic)
- OAuth token acquisition (via Azure SDK or HTTP client)

**Botas-specific instrumentation** (custom spans defined in this spec):

- Full turn pipeline (`botas.turn`)
- Per-middleware execution (`botas.middleware`)
- Handler dispatch (`botas.handler`)
- JWT validation (`botas.auth.inbound`)
- Token acquisition (`botas.auth.outbound`)
- ConversationClient API calls (`botas.conversation_client`)

---

## Dependencies

| Language | Package | Target/Version | Repository |
|----------|---------|----------------|------------|
| .NET | `Microsoft.OpenTelemetry` | net8.0, net10.0 | [microsoft/opentelemetry-distro-dotnet](https://github.com/microsoft/opentelemetry-distro-dotnet) |
| Node.js | `@microsoft/opentelemetry` | Latest | [microsoft/opentelemetry-distro-javascript](https://github.com/microsoft/opentelemetry-distro-javascript) |
| Python | `microsoft-opentelemetry` | Python 3.10+ | [microsoft/opentelemetry-distro-python](https://github.com/microsoft/opentelemetry-distro-python) |

All distros provide **single-call setup**, auto-instrumentation, and export configuration via environment variables or code.

---

## Environment Variables

The Microsoft OTel distros use standard OpenTelemetry environment variables plus Azure-specific variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `OTEL_SERVICE_NAME` | Service name for telemetry | `"echo-bot"` |
| `OTEL_RESOURCE_ATTRIBUTES` | Key-value pairs for resource attributes | `"deployment.environment=production,service.version=1.0.0"` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Azure Monitor (Application Insights) connection string | `"InstrumentationKey=...;IngestionEndpoint=..."` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint (gRPC) | `"http://localhost:4317"` (Aspire Dashboard, Jaeger) |
| `OTEL_TRACES_SAMPLER` | Sampling strategy | `"traceidratio"` (default), `"always_on"`, `"always_off"` |
| `OTEL_TRACES_SAMPLER_ARG` | Sampling parameter (ratio for `traceidratio`) | `"0.1"` (10% sampling) |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | OTLP protocol (gRPC or HTTP) | `"grpc"` (default), `"http/protobuf"` |

> **Azure Monitor + OTLP**: If both `APPLICATIONINSIGHTS_CONNECTION_STRING` and `OTEL_EXPORTER_OTLP_ENDPOINT` are set, telemetry is exported to **both** targets. This is useful for local development (Aspire Dashboard) plus production monitoring (Application Insights).

---

## Setup per Language

### .NET

Install the Microsoft OpenTelemetry distro:

```bash
dotnet add package Microsoft.OpenTelemetry
```

**Simple API** (with `BotApp`):

```csharp
using Botas;
using Microsoft.OpenTelemetry;
using OpenTelemetry;

var app = BotApp.Create(args);

// Enable OpenTelemetry with Microsoft distro
// Export targets auto-detected from env vars:
//   APPLICATIONINSIGHTS_CONNECTION_STRING → Azure Monitor
//   OTEL_EXPORTER_OTLP_ENDPOINT → OTLP collector
app.Builder.Logging.AddOpenTelemetry(o => o.IncludeFormattedMessage = true);

app.Services.AddOpenTelemetry()
    .UseMicrosoftOpenTelemetry(o =>
    {
        o.Exporters = ExportTarget.Otlp | ExportTarget.Console;
    })
    .WithTracing(t => t.AddSource("botas"))
    .WithMetrics(m => m.AddMeter("botas"));

app.On("message", async (context, ct) =>
{
    await context.SendAsync($"Echo: {context.Activity.Text}", ct);
});

app.Run();
```

> **Note**: `.WithTracing(t => t.AddSource("botas"))` and `.WithMetrics(m => m.AddMeter("botas"))` are required in .NET to subscribe to the custom botas Activity Source and Meter. Without these, only auto-instrumented spans (HTTP, Azure SDK) will be exported. `.AddOpenTelemetry(o => o.IncludeFormattedMessage = true)` on the logging builder ensures log messages are rendered (not just templates) in Grafana/Loki.

### Node.js

Install the Microsoft OpenTelemetry distro:

```bash
npm install @microsoft/opentelemetry
```

**Setup**: Call `useMicrosoftOpenTelemetry()` **as early as possible** in the entry point (before importing the bot):

```javascript
// index.js
import { useMicrosoftOpenTelemetry } from "@microsoft/opentelemetry";

// Enable OpenTelemetry first
useMicrosoftOpenTelemetry({
  // Auto-detects export targets from env vars:
  // - APPLICATIONINSIGHTS_CONNECTION_STRING → Azure Monitor
  // - OTEL_EXPORTER_OTLP_ENDPOINT → OTLP collector
  // Defaults to Console if neither is set
  instrumentationOptions: {
    http: { enabled: true },
    azureSdk: { enabled: true },
    // Add database instrumentation if used:
    // mongoDb: { enabled: true },
    // postgreSql: { enabled: true },
    // redis: { enabled: true },
  },
});

// Now import and start the bot
import { BotApp } from "botas-express";

const bot = new BotApp();
bot.on("message", async (context) => {
  await context.send(`Echo: ${context.activity.text}`);
});

const app = bot.start();
app.listen(process.env.PORT || 3978);
```

**Custom sampling**:

```javascript
useMicrosoftOpenTelemetry({
  samplingRatio: 0.1,         // 10% sampling
  tracesPerSecond: 100,       // Rate-limit to 100 traces/sec
  instrumentationOptions: {
    http: { enabled: true },
    azureSdk: { enabled: true },
  },
});
```

**Logs export**: To send botas logs as OTel log records (exported to Grafana Loki, Azure Monitor, etc.), use `createOtelLogger()`:

```javascript
import { configure, createOtelLogger, consoleLogger } from "botas-core";

// Use OTel logger when available, fall back to console
configure(createOtelLogger() ?? consoleLogger);
```

This emits structured log records with severity levels via the OpenTelemetry Logs API. Logs are automatically correlated with the active trace context.

### Python

Install the Microsoft OpenTelemetry distro:

```bash
pip install microsoft-opentelemetry
```

**Setup**: Call `use_microsoft_opentelemetry()` **at the top of the entry point** (before creating the bot):

```python
# main.py
from microsoft.opentelemetry import use_microsoft_opentelemetry

# Enable OpenTelemetry first
use_microsoft_opentelemetry(
    enable_otlp=True,  # Required to export to OTLP endpoint
    # Auto-detects OTLP endpoint from OTEL_EXPORTER_OTLP_ENDPOINT env var
    # For Azure Monitor, use enable_azure_monitor=True instead
)

from botas_fastapi import BotApp

bot = BotApp()

@bot.on("message")
async def on_message(context):
    await context.send(f"Echo: {context.activity.text}")

# Start the bot (FastAPI server)
bot.start()
```

> **Note**: The import path is `from microsoft.opentelemetry import ...` (dot-separated namespace). The `enable_otlp=True` parameter is required to activate OTLP export — without it, only Azure Monitor export is available.

**Azure Monitor explicit configuration**:

```python
use_microsoft_opentelemetry(
    enable_azure_monitor=True,
    azure_monitor_connection_string="InstrumentationKey=...;IngestionEndpoint=...",
)
```

**Console for development**:

```python
# Console export is not directly available in the Python distro.
# Use OTLP with a local collector, or use opentelemetry-sdk directly:
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor
use_microsoft_opentelemetry(
    enable_otlp=True,
    span_processors=[SimpleSpanProcessor(ConsoleSpanExporter())],
)
```

**Logs export**: To send Python logs as OTel log records (exported to Grafana Loki, Azure Monitor, etc.), use the `LoggingInstrumentor`:

```python
import logging
from opentelemetry.instrumentation.logging import LoggingInstrumentor

# After use_microsoft_opentelemetry() call:
LoggingInstrumentor().instrument(set_logging_format=True)
logging.basicConfig(level=logging.INFO)
```

This bridges Python's `logging` module into the OTel LoggerProvider. Logs are automatically correlated with the active trace context. Requires `opentelemetry-instrumentation-logging` package.

---

## Export Targets

| Target | When to use | Configuration |
|--------|-------------|---------------|
| **Azure Monitor** (Application Insights) | Production monitoring, Azure-hosted bots | Set `APPLICATIONINSIGHTS_CONNECTION_STRING` env var or pass connection string in code |
| **OTLP** (Grafana LGTM, Jaeger, Aspire Dashboard) | Local development, multi-cloud deployments | Set `OTEL_EXPORTER_OTLP_ENDPOINT` env var (e.g., `http://localhost:4317`). Python also requires `enable_otlp=True`. |
| **Console** | Debugging during development | .NET: `ExportTarget.Console`. Node.js: defaults to Console if no endpoint is set. Python: use `span_processors` kwarg. |

**Local development with Grafana LGTM** (recommended — gives traces, metrics, AND logs in one container):

```bash
docker run --rm -d --name lgtm -p 3000:3000 -p 4317:4317 -p 4318:4318 grafana/otel-lgtm
# Open http://localhost:3000 (admin/admin)
# Explore → Tempo (traces), Mimir (metrics), Loki (logs)
```

**Multiple targets**: You can export to **both** Azure Monitor and OTLP simultaneously by setting both environment variables. This is useful for dual-pane visibility during development (local Aspire Dashboard + cloud Application Insights).

---

## Auto-Instrumentation Coverage

The Microsoft OTel distros automatically instrument the following without any code changes:

| Component | What gets traced | Span name example |
|-----------|------------------|-------------------|
| HTTP server | Inbound `POST /api/messages` | `POST /api/messages` |
| HTTP client | Outbound Bot Service API calls | `POST {serviceUrl}v3/conversations/{id}/activities` |
| Azure SDK | Token acquisition, Key Vault, Storage | `Azure.Core.HttpRequest` |
| Database clients | SQL, MongoDB, PostgreSQL, Redis queries | Varies by driver |

These spans are emitted by the underlying HTTP/database libraries and include standard OpenTelemetry semantic conventions (http.method, http.status_code, http.url, etc.).

---

## Botas-Specific Custom Spans

Botas implementations SHOULD emit the following custom spans to provide bot-specific context on top of auto-instrumentation. All spans use the `botas` Activity Source.

### Activity Source

| Language | Declaration |
|----------|-------------|
| .NET | `private static readonly ActivitySource ActivitySource = new("botas", Assembly.GetExecutingAssembly().GetName().Version!.ToString());` |
| Node.js | `import { trace } from "@opentelemetry/api"; const tracer = trace.getTracer("botas", require("./package.json").version);` |
| Python | `from opentelemetry import trace; tracer = trace.get_tracer("botas", __version__)` |

### Span Definitions

#### `botas.turn`

Spans the **full turn pipeline** from JWT validation to response.

**Attributes**:

| Key | Description | Example |
|-----|-------------|---------|
| `activity.type` | Activity type | `"message"` |
| `activity.id` | Activity ID | `"1234567890"` |
| `conversation.id` | Conversation ID | `"a:1AbC2dEfG"` |
| `channel.id` | Channel (Teams, Slack, etc.) | `"msteams"` |
| `bot.id` | Bot's Client ID | `"12345678-abcd-..."` |

**When**: Start at the beginning of `processBody()` / `ProcessAsync()` / `process_body()` (after JWT validation completes). End when the response is sent.

#### `botas.middleware`

Spans **each middleware execution**.

**Attributes**:

| Key | Description | Example |
|-----|-------------|---------|
| `middleware.name` | Middleware function/class name | `"LoggingMiddleware"` |
| `middleware.index` | Registration order (0-based) | `0` |

**When**: Start before calling the middleware function. End after it returns (or after `next()` completes if the middleware awaits `next()`).

**Parent**: `botas.turn`

#### `botas.handler`

Spans **handler dispatch and execution**.

**Attributes**:

| Key | Description | Example |
|-----|-------------|---------|
| `handler.type` | Handler type (activity type or invoke name) | `"message"` (for activity type) or `"actionableMessage/executeAction"` (for invoke name) |
| `handler.dispatch` | Dispatch mode | `"type"` (per-type), `"invoke"` (invoke), `"catchall"` |

**When**: Start before calling the handler. End after the handler returns.

**Parent**: `botas.turn`

#### `botas.auth.inbound`

Spans **JWT validation** (inbound auth).

**Attributes**:

| Key | Description | Example |
|-----|-------------|---------|
| `auth.issuer` | Token issuer | `"https://api.botframework.com"` |
| `auth.audience` | Token audience | `"12345678-abcd-..."` |
| `auth.key_id` | JWT `kid` header | `"abc123"` |

**When**: Start before JWT validation. End after signature verification completes.

**Parent**: HTTP server span (auto-instrumented)

> **Note**: This span is emitted by the **auth middleware layer** (ASP.NET auth middleware, `botAuthExpress`, `bot_auth_dependency`), not by `BotApplication`.

#### `botas.auth.outbound`

Spans **OAuth2 token acquisition** (outbound auth).

**Attributes**:

| Key | Description | Example |
|-----|-------------|---------|
| `auth.token_endpoint` | OAuth2 token endpoint | `"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"` |
| `auth.scope` | Requested scope | `"https://api.botframework.com/.default"` |
| `auth.flow` | Auth flow type | `"client_credentials"`, `"managed_identity"`, `"federated_identity"` |
| `auth.cache_hit` | Whether token was served from cache | `true` / `false` |

**When**: Start before calling `TokenManager.getToken()` / `TokenManager.GetTokenAsync()` / `token_manager.get_token()`. End after token acquisition completes (or cache retrieval).

**Parent**: `botas.conversation_client` or `botas.turn` (if token is pre-fetched)

#### `botas.conversation_client`

Spans **outbound Bot Service API calls** (ConversationClient).

**Attributes**:

| Key | Description | Example |
|-----|-------------|---------|
| `conversation.id` | Target conversation ID | `"a:1AbC2dEfG"` |
| `activity.type` | Activity type being sent | `"message"` |
| `activity.id` | Activity ID (response) | `"1234567890"` |
| `service.url` | Bot Service service URL | `"https://smba.trafficmanager.net/amer/"` |

**When**: Start before calling `sendActivityAsync()` / `SendActivityAsync()` / `send_activity()`. End after the HTTP response is received.

**Parent**: Handler span or middleware span (whoever initiates the send)

> **Note**: The underlying HTTP client span is auto-instrumented and will be a child of this span.

---

## Botas-Specific Custom Metrics

Botas implementations SHOULD emit the following custom metrics using the OpenTelemetry Metrics API. All metrics use the `botas` meter name.

### Meter

| Language | Declaration |
|----------|-------------|
| .NET | `private static readonly Meter BotasMeter = new("botas", Assembly.GetExecutingAssembly().GetName().Version!.ToString());` |
| Node.js | `import { metrics } from "@opentelemetry/api"; const meter = metrics.getMeter("botas", version);` |
| Python | `from opentelemetry import metrics; meter = metrics.get_meter("botas", __version__)` |

### Metric Definitions

#### `botas.activities.received` (Counter)

Total activities received by the bot.

| Attribute | Description | Example |
|-----------|-------------|---------|
| `activity.type` | Activity type | `"message"`, `"invoke"`, `"conversationUpdate"` |

#### `botas.turn.duration` (Histogram, ms)

Duration of full turn processing (from activity received to response sent).

| Attribute | Description | Example |
|-----------|-------------|---------|
| `activity.type` | Activity type | `"message"` |

#### `botas.handler.errors` (Counter)

Total handler errors (exceptions thrown by registered handlers).

| Attribute | Description | Example |
|-----------|-------------|---------|
| `activity.type` | Activity type of the failing handler | `"message"` |

#### `botas.middleware.duration` (Histogram, ms)

Duration of individual middleware execution.

| Attribute | Description | Example |
|-----------|-------------|---------|
| `middleware.name` | Middleware function/class name | `"LoggingMiddleware"` |

#### `botas.outbound.calls` (Counter)

Total outbound API calls to the Bot Service Conversations API.

| Attribute | Description | Example |
|-----------|-------------|---------|
| `operation` | API operation | `"sendActivity"`, `"updateActivity"`, `"deleteActivity"` |

#### `botas.outbound.errors` (Counter)

Total outbound API call errors.

| Attribute | Description | Example |
|-----------|-------------|---------|
| `operation` | API operation that failed | `"sendActivity"` |

### Viewing Metrics

With the Grafana LGTM stack (`grafana/otel-lgtm`), query metrics via Prometheus:

```promql
# Activity rate by type
rate(botas_activities_received_total[5m])

# Average turn duration
rate(botas_turn_duration_sum[5m]) / rate(botas_turn_duration_count[5m])

# Error rate
rate(botas_handler_errors_total[5m])

# Outbound call rate
rate(botas_outbound_calls_total{operation="sendActivity"}[5m])
```

> **Note**: OTLP metric names use dots (`botas.turn.duration`) but Prometheus converts them to underscores (`botas_turn_duration`).

---

## Sampling Configuration

All three distros support sampling to control telemetry volume:

| Method | Configuration |
|--------|---------------|
| **Ratio-based** | Set `OTEL_TRACES_SAMPLER=traceidratio` and `OTEL_TRACES_SAMPLER_ARG=0.1` (10% sampling) |
| **Rate-limited** | Node.js: `tracesPerSecond: 100` in `useMicrosoftOpenTelemetry()` options |
| **Always on** | Set `OTEL_TRACES_SAMPLER=always_on` (default for development) |
| **Always off** | Set `OTEL_TRACES_SAMPLER=always_off` (disable tracing) |

**Recommended for production**: Start with 10% ratio sampling (`OTEL_TRACES_SAMPLER_ARG=0.1`) and adjust based on telemetry volume and cost.

---

## Integration with Existing Pipeline

Observability spans fit into the existing turn pipeline defined in [Architecture](./architecture.md):

```
HTTP POST /api/messages
  │
  ├─ Auto-instrumented HTTP server span (distro)
  │   └─ botas.auth.inbound (auth middleware)
  │
  └─ botas.turn
       ├─ botas.middleware (for each middleware)
       │   └─ botas.middleware (nested if middleware calls next)
       │
       └─ botas.handler
            └─ botas.conversation_client (if bot sends a reply)
                 ├─ botas.auth.outbound (token acquisition)
                 └─ Auto-instrumented HTTP client span (distro)
```

**Key points**:

- **Auto-instrumentation provides HTTP-level visibility**: Request path, status code, latency.
- **Botas-specific spans add bot-level semantics**: Activity type, handler dispatch mode, conversation ID.
- **Distributed tracing works across bots**: If a bot calls another bot or external service, the trace context propagates via standard W3C Trace Context headers.

---

## Language-Specific Differences

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Setup call | `app.Services.AddOpenTelemetry().UseMicrosoftOpenTelemetry(...)` | `useMicrosoftOpenTelemetry(...)` | `use_microsoft_opentelemetry(...)` |
| Call timing | After `BotApp.Create()`, before `app.Run()` | **Before any imports** (top of entry point) | **Before any imports** (top of entry point) |
| Import path | `using Microsoft.OpenTelemetry;` | `import { useMicrosoftOpenTelemetry } from "@microsoft/opentelemetry"` | `from microsoft.opentelemetry import use_microsoft_opentelemetry` |
| Custom source/meter | `.WithTracing(t => t.AddSource("botas")).WithMetrics(m => m.AddMeter("botas"))` (required) | Automatic (SDK picks up all tracers) | Automatic (SDK picks up all tracers) |
| Export target config | `ExportTarget` flags enum | Env vars only (`APPLICATIONINSIGHTS_CONNECTION_STRING`, `OTEL_EXPORTER_OTLP_ENDPOINT`) | `enable_otlp=True`, `enable_azure_monitor=True`, or env vars |
| Activity Source API | `System.Diagnostics.ActivitySource` | `@opentelemetry/api` `trace.getTracer()` | `opentelemetry.trace` `trace.get_tracer()` |
| Span start/end | `using var activity = ActivitySource.StartActivity("name")` | `await withActiveSpan("name", async (span) => { ... })` | `with tracer.start_as_current_span("name"):` |
| Span attributes | `activity?.SetTag("key", "value")` | `span.setAttribute("key", "value")` | `span.set_attribute("key", "value")` |
| Logs export | `app.Builder.Logging.AddOpenTelemetry(o => o.IncludeFormattedMessage = true)` | `configure(createOtelLogger())` | `LoggingInstrumentor().instrument(set_logging_format=True)` |
| Sampling config (ratio) | `OTEL_TRACES_SAMPLER_ARG` env var | `samplingRatio: 0.1` or `OTEL_TRACES_SAMPLER_ARG` env var | `OTEL_TRACES_SAMPLER_ARG` env var |

---

## Best Practices

1. **Enable OTel early**: Call the distro setup function before any bot imports to ensure auto-instrumentation captures all library initialization.
2. **Use Azure Monitor for production**: Application Insights provides built-in dashboards, alerting, and dependency tracking.
3. **Use OTLP for local development**: Run Grafana LGTM (`docker run --rm -d --name lgtm -p 3000:3000 -p 4317:4317 -p 4318:4318 grafana/otel-lgtm`) for full traces, metrics, and logs visualization at http://localhost:3000 (admin/admin). Alternatively, use Aspire Dashboard (`docker run -p 4317:4317 -p 18888:18888 mcr.microsoft.com/dotnet/aspire-dashboard:latest`) for traces only.
4. **Set `OTEL_SERVICE_NAME`**: Use a descriptive service name (`"echo-bot"`, `"teams-support-bot"`) to distinguish your bot in multi-service traces.
5. **Add resource attributes**: Use `OTEL_RESOURCE_ATTRIBUTES="deployment.environment=production,service.version=1.2.3"` to enrich telemetry with deployment context.
6. **Sample in production**: Start with 10% ratio sampling to control cost and volume.
7. **Enrich spans with bot-specific attributes**: Add custom attributes (e.g., `user.id`, `team.id`) to spans where relevant for bot-specific analysis.
8. **Register custom sources (.NET only)**: Always add `.WithTracing(t => t.AddSource("botas")).WithMetrics(m => m.AddMeter("botas"))` — .NET requires explicit subscription to custom Activity Sources and Meters. Node.js and Python pick them up automatically.

---

## References

- [Microsoft OpenTelemetry Distro for .NET](https://github.com/microsoft/opentelemetry-distro-dotnet)
- [Microsoft OpenTelemetry Distro for Node.js](https://github.com/microsoft/opentelemetry-distro-javascript)
- [Microsoft OpenTelemetry Distro for Python](https://github.com/microsoft/opentelemetry-distro-python)
- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/otel/)
- [Azure Monitor OpenTelemetry](https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-enable)
- [Architecture](./architecture.md) — turn pipeline and component diagram
- [Configuration](./configuration.md) — environment variables and auth flows
