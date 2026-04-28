"""Tests for OpenTelemetry span instrumentation in BotApplication."""

from __future__ import annotations

import json
from typing import Awaitable, Callable, Sequence

import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ReadableSpan, SimpleSpanProcessor, SpanExporter, SpanExportResult

import botas.tracer_provider as tracer_mod
from botas.bot_application import BotApplication, InvokeResponse
from botas.i_turn_middleware import TurnMiddleware
from botas.turn_context import TurnContext


class _InMemoryExporter(SpanExporter):
    """Minimal in-memory span exporter for tests."""

    def __init__(self) -> None:
        self.spans: list[ReadableSpan] = []

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        self.spans.extend(spans)
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        pass

    def get_finished_spans(self) -> list[ReadableSpan]:
        return list(self.spans)


def _make_body(**overrides: object) -> str:
    data: dict[str, object] = {
        "type": "message",
        "id": "act1",
        "channelId": "msteams",
        "serviceUrl": "http://localhost:3978/",
        "from": {"id": "user1"},
        "recipient": {"id": "bot1"},
        "conversation": {"id": "conv1"},
        "text": "hello",
    }
    data.update(overrides)
    return json.dumps(data)


@pytest.fixture(autouse=True)
def _setup_otel(monkeypatch: pytest.MonkeyPatch):
    """Configure an in-memory OTel tracer and reset cache after each test."""
    provider = TracerProvider()
    exporter = _InMemoryExporter()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("botas", "test")

    # Patch the cached tracer so get_tracer() returns our test tracer
    monkeypatch.setattr(tracer_mod, "_tracer", tracer)
    monkeypatch.setattr(tracer_mod, "_initialized", True)

    yield exporter

    # Reset tracer cache
    monkeypatch.setattr(tracer_mod, "_tracer", None)
    monkeypatch.setattr(tracer_mod, "_initialized", False)


@pytest.fixture()
def exporter(_setup_otel: _InMemoryExporter) -> _InMemoryExporter:
    return _setup_otel


class TestTurnSpan:
    async def test_turn_span_created_with_attributes(self, exporter: _InMemoryExporter):
        bot = BotApplication()
        bot.on("message", handler=AsyncNoop())
        await bot.process_body(_make_body())

        spans = exporter.get_finished_spans()
        turn_spans = [s for s in spans if s.name == "botas.turn"]
        assert len(turn_spans) == 1
        attrs = dict(turn_spans[0].attributes or {})
        assert attrs["activity.type"] == "message"
        assert attrs["activity.id"] == "act1"
        assert attrs["conversation.id"] == "conv1"
        assert attrs["channel.id"] == "msteams"

    async def test_turn_span_wraps_handler_span(self, exporter: _InMemoryExporter):
        bot = BotApplication()
        bot.on("message", handler=AsyncNoop())
        await bot.process_body(_make_body())

        spans = exporter.get_finished_spans()
        turn_span = next(s for s in spans if s.name == "botas.turn")
        handler_span = next(s for s in spans if s.name == "botas.handler")
        # Handler should be a child of turn
        assert handler_span.parent is not None
        assert handler_span.parent.span_id == turn_span.context.span_id


class TestMiddlewareSpan:
    async def test_middleware_span_per_middleware(self, exporter: _InMemoryExporter):
        bot = BotApplication()
        bot.use(PassthroughMiddleware("MW_A"))
        bot.use(PassthroughMiddleware("MW_B"))
        bot.on("message", handler=AsyncNoop())
        await bot.process_body(_make_body())

        spans = exporter.get_finished_spans()
        mw_spans = [s for s in spans if s.name == "botas.middleware"]
        assert len(mw_spans) == 2

        names = [dict(s.attributes or {}).get("middleware.name") for s in mw_spans]
        assert "PassthroughMiddleware" in names[0]  # type: ignore[operator]
        assert "PassthroughMiddleware" in names[1]  # type: ignore[operator]

        indices = sorted(dict(s.attributes or {}).get("middleware.index", -1) for s in mw_spans)
        assert indices == [0, 1]


class TestHandlerSpan:
    async def test_handler_span_type_dispatch(self, exporter: _InMemoryExporter):
        bot = BotApplication()
        bot.on("message", handler=AsyncNoop())
        await bot.process_body(_make_body())

        spans = exporter.get_finished_spans()
        handler_spans = [s for s in spans if s.name == "botas.handler"]
        assert len(handler_spans) == 1
        attrs = dict(handler_spans[0].attributes or {})
        assert attrs["handler.type"] == "message"
        assert attrs["handler.dispatch"] == "typed"

    async def test_handler_span_catchall_dispatch(self, exporter: _InMemoryExporter):
        bot = BotApplication()
        bot.on_activity = AsyncNoop()
        await bot.process_body(_make_body())

        spans = exporter.get_finished_spans()
        handler_spans = [s for s in spans if s.name == "botas.handler"]
        assert len(handler_spans) == 1
        attrs = dict(handler_spans[0].attributes or {})
        assert attrs["handler.dispatch"] == "on_activity"

    async def test_handler_span_invoke_dispatch(self, exporter: _InMemoryExporter):
        bot = BotApplication()

        async def invoke_handler(ctx: TurnContext) -> InvokeResponse:
            return InvokeResponse(status=200, body={"ok": True})

        bot.on_invoke("test/action", invoke_handler)
        body = _make_body(type="invoke", name="test/action")
        await bot.process_body(body)

        spans = exporter.get_finished_spans()
        handler_spans = [s for s in spans if s.name == "botas.handler"]
        assert len(handler_spans) == 1
        attrs = dict(handler_spans[0].attributes or {})
        assert attrs["handler.type"] == "invoke"
        assert attrs["handler.dispatch"] == "invoke"

    async def test_no_handler_span_when_no_handler(self, exporter: _InMemoryExporter):
        bot = BotApplication()
        await bot.process_body(_make_body())

        spans = exporter.get_finished_spans()
        handler_spans = [s for s in spans if s.name == "botas.handler"]
        assert len(handler_spans) == 0


class TestNoOtelConfigured:
    async def test_works_without_tracer(self, monkeypatch: pytest.MonkeyPatch):
        """When tracer is None, everything works — zero overhead path."""
        monkeypatch.setattr(tracer_mod, "_tracer", None)
        monkeypatch.setattr(tracer_mod, "_initialized", True)

        bot = BotApplication()
        received: list[TurnContext] = []

        async def handler(ctx: TurnContext) -> None:
            received.append(ctx)

        bot.on("message", handler)
        await bot.process_body(_make_body())
        assert len(received) == 1


# --- Helpers ---


class AsyncNoop:
    """Callable that does nothing, usable as an activity handler."""

    async def __call__(self, ctx: TurnContext) -> None:
        pass


class PassthroughMiddleware(TurnMiddleware):
    """Middleware that just calls next."""

    def __init__(self, name: str = "Passthrough") -> None:
        self._name = name

    async def on_turn(self, context: TurnContext, next_fn: Callable[[], Awaitable[None]]) -> None:
        await next_fn()
