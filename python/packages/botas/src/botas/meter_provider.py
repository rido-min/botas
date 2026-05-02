"""Lazy OpenTelemetry meter provider for botas metrics instrumentation.

Returns ``None`` when ``opentelemetry-api`` is not installed — all metric
operations become no-ops and the library works without telemetry.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from opentelemetry.metrics import Counter, Histogram, Meter


class BotasMetrics:
    """Pre-created metric instruments for botas."""

    def __init__(self, meter: Meter) -> None:
        self.activities_received: Counter = meter.create_counter(
            "botas.activities.received",
            description="Total activities received by the bot",
            unit="{activity}",
        )
        self.turn_duration: Histogram = meter.create_histogram(
            "botas.turn.duration",
            description="Duration of turn processing",
            unit="ms",
        )
        self.handler_errors: Counter = meter.create_counter(
            "botas.handler.errors",
            description="Total handler errors",
            unit="{error}",
        )
        self.middleware_duration: Histogram = meter.create_histogram(
            "botas.middleware.duration",
            description="Duration of individual middleware execution",
            unit="ms",
        )
        self.outbound_calls: Counter = meter.create_counter(
            "botas.outbound.calls",
            description="Total outbound API calls to Bot Service",
            unit="{call}",
        )
        self.outbound_errors: Counter = meter.create_counter(
            "botas.outbound.errors",
            description="Total outbound API call errors",
            unit="{error}",
        )


_metrics: Optional[BotasMetrics] = None
_initialized: bool = False


def get_metrics() -> Optional[BotasMetrics]:
    """Return pre-created metric instruments, or ``None`` if unavailable."""
    global _metrics, _initialized
    if _initialized:
        return _metrics
    _initialized = True
    try:
        from opentelemetry import metrics

        from botas._version import __version__

        meter = metrics.get_meter("botas", __version__)
        _metrics = BotasMetrics(meter)
    except ImportError:
        _metrics = None
    return _metrics
