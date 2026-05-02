# OTel Bot — OpenTelemetry observability sample
# Run: python main.py

# --- OpenTelemetry setup (must come before any other imports) ---
# OTel must be initialized first so auto-instrumentation can patch
# HTTP libraries before they are imported by botas/FastAPI.
#
# Configure via environment variables:
#   OTEL_SERVICE_NAME=otel-bot
#   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317   (for Aspire Dashboard / Jaeger)
#   APPLICATIONINSIGHTS_CONNECTION_STRING=...            (for Azure Monitor in production)
#
# To run Grafana LGTM locally:
#   docker run --rm -d --name lgtm -p 3000:3000 -p 4317:4317 -p 4318:4318 grafana/otel-lgtm
#   set OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
#   Then open http://localhost:3000 (admin/admin) to view traces, metrics, and logs.
try:
    from microsoft.opentelemetry import use_microsoft_opentelemetry

    use_microsoft_opentelemetry(enable_otlp=True)
except ImportError:
    # microsoft-opentelemetry is a required dependency for this sample.
    # If you see this, run: pip install -e .
    raise

import logging

from opentelemetry.instrumentation.logging import LoggingInstrumentor

# Bridge Python logging → OTel LoggerProvider so logs appear in Grafana/Loki
LoggingInstrumentor().instrument(set_logging_format=True)
logging.basicConfig(level=logging.INFO)

from botas_fastapi import BotApp  # noqa: E402

app = BotApp()
logger = logging.getLogger("otel-bot")


@app.on("message")
async def on_message(ctx):
    logger.info("Received message: %s", ctx.activity.text)
    await ctx.send(f"You said: {ctx.activity.text}")


app.start()
