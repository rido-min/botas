"""Tests for botas.tracer_provider."""

from unittest.mock import patch

import botas.tracer_provider as tp


def _reset():
    """Reset module-level cache between tests."""
    tp._tracer = None
    tp._initialized = False


def test_get_tracer_returns_tracer():
    _reset()
    tracer = tp.get_tracer()
    assert tracer is not None


def test_get_tracer_returns_tracer_consistently():
    _reset()
    t1 = tp.get_tracer()
    t2 = tp.get_tracer()
    assert t1 is not None
    assert t2 is not None


def test_get_tracer_returns_none_when_not_installed():
    _reset()
    with patch.dict("sys.modules", {"opentelemetry": None, "opentelemetry.trace": None}):
        tracer = tp.get_tracer()
        assert tracer is None
