# AI OTel Bot — LangChain + OpenTelemetry observability sample
# Run: python main.py
# Env: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT

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
import os

from opentelemetry import trace
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.trace import SpanKind, StatusCode

# Bridge Python logging → OTel LoggerProvider so logs appear in Grafana/Loki
LoggingInstrumentor().instrument(set_logging_format=True)
logging.basicConfig(level=logging.INFO)

from botas_fastapi import BotApp  # noqa: E402
from langchain_azure_ai.chat_models import AzureAIChatCompletionsModel  # noqa: E402
from langchain_core.messages import AIMessage, HumanMessage  # noqa: E402

endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
api_key = os.environ.get("AZURE_OPENAI_API_KEY", "")
deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")

tracer = trace.get_tracer("langchain")

model = AzureAIChatCompletionsModel(
    endpoint=endpoint,
    credential=api_key,
    model=deployment,
)

conversation_histories: dict[str, list] = {}

app = BotApp()
logger = logging.getLogger("otel-bot")


@app.on("message")
async def on_message(ctx):
    conversation_id = ctx.activity.conversation.id
    history = conversation_histories.get(conversation_id, [])

    history.append(HumanMessage(content=ctx.activity.text or ""))

    await ctx.send_typing()

    with tracer.start_as_current_span("langchain.llm", kind=SpanKind.CLIENT) as span:
        try:
            response = await model.ainvoke(history)
            if hasattr(response, "response_metadata"):
                usage = response.response_metadata.get("token_usage", {})
                if usage:
                    span.set_attribute("llm.usage.prompt_tokens", usage.get("prompt_tokens", 0))
                    span.set_attribute("llm.usage.completion_tokens", usage.get("completion_tokens", 0))
                    span.set_attribute("llm.usage.total_tokens", usage.get("total_tokens", 0))
        except Exception as e:
            span.record_exception(e)
            span.set_status(StatusCode.ERROR, str(e))
            raise

    history.append(AIMessage(content=response.content))
    conversation_histories[conversation_id] = history

    logger.info("AI response for conversation %s", conversation_id)
    await ctx.send(response.content)


app.start()
