"""Tests for the meter_provider module."""

from unittest.mock import patch


class TestGetMetrics:
    """Tests for get_metrics() lazy initialization."""

    def setup_method(self):
        """Reset module state before each test."""
        import botas.meter_provider as mp

        mp._initialized = False
        mp._metrics = None

    def test_get_metrics_returns_metrics(self):
        """get_metrics() returns BotasMetrics when opentelemetry is available."""
        from botas.meter_provider import get_metrics

        metrics = get_metrics()
        assert metrics is not None
        assert metrics.activities_received is not None
        assert metrics.turn_duration is not None
        assert metrics.handler_errors is not None
        assert metrics.middleware_duration is not None
        assert metrics.outbound_calls is not None
        assert metrics.outbound_errors is not None

    def test_get_metrics_cached(self):
        """get_metrics() returns the same instance on repeated calls."""
        from botas.meter_provider import get_metrics

        m1 = get_metrics()
        m2 = get_metrics()
        assert m1 is m2

    def test_get_metrics_returns_none_when_not_installed(self):
        """get_metrics() returns None when opentelemetry is not installed."""
        from botas.meter_provider import get_metrics

        with patch.dict("sys.modules", {"opentelemetry": None, "opentelemetry.metrics": None}):
            import botas.meter_provider as mp

            mp._initialized = False
            mp._metrics = None
            result = get_metrics()
            assert result is None
