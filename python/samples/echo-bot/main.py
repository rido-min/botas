# Echo Bot — minimal BotApp sample
# Run: python main.py

# --- OpenTelemetry setup (must come before any other imports) ---
# OTel must be initialized first so auto-instrumentation can patch
# HTTP libraries before they are imported by botas/FastAPI.
#
# Install: pip install microsoft-opentelemetry
#
# Configure via environment variables:
#   OTEL_SERVICE_NAME=echo-bot
#   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317   (for Aspire Dashboard / Jaeger)
#   APPLICATIONINSIGHTS_CONNECTION_STRING=...            (for Azure Monitor in production)
#
# Local dev with Aspire Dashboard:
#   docker run -p 4317:4317 -p 18888:18888 mcr.microsoft.com/dotnet/aspire-dashboard:latest
#   Then open http://localhost:18888 to view traces.
#
# For production, set APPLICATIONINSIGHTS_CONNECTION_STRING to export
# telemetry to Azure Monitor (Application Insights).
try:
    from microsoft_opentelemetry import use_microsoft_opentelemetry

    use_microsoft_opentelemetry()
except ImportError:
    # OTel packages not installed — bot still works without telemetry.
    pass

from botas_fastapi import BotApp

app = BotApp()


@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")


app.start()
