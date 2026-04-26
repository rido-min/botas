"""Tests for OpenTelemetry span instrumentation in ConversationClient."""

from __future__ import annotations

from typing import Any, Sequence
from unittest.mock import AsyncMock, patch

import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ReadableSpan, SimpleSpanProcessor, SpanExporter, SpanExportResult

import botas.tracer_provider as tracer_mod
from botas.conversation_client import ConversationClient
from botas.core_activity import CoreActivity


class _InMemoryExporter(SpanExporter):
    def __init__(self) -> None:
        self.spans: list[ReadableSpan] = []

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        self.spans.extend(spans)
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        pass

    def get_finished_spans(self) -> list[ReadableSpan]:
        return list(self.spans)


@pytest.fixture(autouse=True)
def _setup_otel(monkeypatch: pytest.MonkeyPatch):
    provider = TracerProvider()
    exporter = _InMemoryExporter()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("botas", "test")
    monkeypatch.setattr(tracer_mod, "_tracer", tracer)
    monkeypatch.setattr(tracer_mod, "_initialized", True)
    yield exporter
    monkeypatch.setattr(tracer_mod, "_tracer", None)
    monkeypatch.setattr(tracer_mod, "_initialized", False)


@pytest.fixture()
def exporter(_setup_otel: _InMemoryExporter) -> _InMemoryExporter:
    return _setup_otel


class TestConversationClientSpan:
    async def test_span_created_with_attributes(self, exporter: _InMemoryExporter):
        client = ConversationClient(get_token=AsyncMock(return_value="tok"))
        activity = CoreActivity(type="message", text="hi")

        mock_response = {"id": "resp-1"}
        with patch.object(client._http, "post", new_callable=AsyncMock, return_value=mock_response):
            result = await client.send_activity_async("https://smba.trafficmanager.net/teams/", "conv-123", activity)

        assert result is not None
        assert result.id == "resp-1"

        spans = exporter.get_finished_spans()
        cc_spans = [s for s in spans if s.name == "botas.conversation_client"]
        assert len(cc_spans) == 1
        attrs = dict(cc_spans[0].attributes or {})
        assert attrs["conversation.id"] == "conv-123"
        assert attrs["activity.type"] == "message"
        assert attrs["service.url"] == "https://smba.trafficmanager.net/teams/"
        assert attrs["activity.id"] == "resp-1"

    async def test_span_activity_id_empty_on_none_response(self, exporter: _InMemoryExporter):
        client = ConversationClient(get_token=AsyncMock(return_value="tok"))
        activity = CoreActivity(type="message", text="hi")

        with patch.object(client._http, "post", new_callable=AsyncMock, return_value=None):
            result = await client.send_activity_async("https://example.com/", "conv-1", activity)

        assert result is None
        spans = exporter.get_finished_spans()
        cc_spans = [s for s in spans if s.name == "botas.conversation_client"]
        assert len(cc_spans) == 1
        attrs = dict(cc_spans[0].attributes or {})
        assert attrs["conversation.id"] == "conv-1"
        # No activity.id set when result is None
        assert "activity.id" not in attrs

    async def test_span_with_dict_activity(self, exporter: _InMemoryExporter):
        client = ConversationClient(get_token=AsyncMock(return_value="tok"))
        activity: dict[str, Any] = {"type": "typing"}

        with patch.object(client._http, "post", new_callable=AsyncMock, return_value=None):
            await client.send_activity_async("https://example.com/", "conv-2", activity)

        spans = exporter.get_finished_spans()
        cc_spans = [s for s in spans if s.name == "botas.conversation_client"]
        assert len(cc_spans) == 1
        attrs = dict(cc_spans[0].attributes or {})
        # dict has no .type attribute — falls back to ""
        assert attrs["activity.type"] == ""

    async def test_no_span_without_tracer(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(tracer_mod, "_tracer", None)
        monkeypatch.setattr(tracer_mod, "_initialized", True)

        client = ConversationClient(get_token=AsyncMock(return_value="tok"))
        activity = CoreActivity(type="message", text="hi")

        mock_response = {"id": "resp-1"}
        with patch.object(client._http, "post", new_callable=AsyncMock, return_value=mock_response):
            result = await client.send_activity_async("https://example.com/", "conv-1", activity)

        assert result is not None
        assert result.id == "resp-1"
