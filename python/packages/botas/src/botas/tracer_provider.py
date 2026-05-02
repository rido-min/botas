"""Lazy OpenTelemetry tracer provider for botas instrumentation.

Returns ``None`` when ``opentelemetry-api`` is not installed — all span
operations become no-ops and the library works without telemetry.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from opentelemetry.trace import Tracer

_tracer: Tracer | None = None
_initialized: bool = False


def get_tracer() -> Tracer | None:
    """Return the shared OpenTelemetry tracer, or ``None`` if unavailable.

    If ``_tracer`` is set (e.g. for testing), returns it directly.
    When ``_initialized`` is True and ``_tracer`` is None, returns None (no-op).
    Otherwise calls ``trace.get_tracer()`` each time to pick up the
    currently configured global TracerProvider.
    """
    if _initialized:
        return _tracer
    try:
        from opentelemetry import trace

        from botas._version import __version__

        return trace.get_tracer("botas", __version__)
    except ImportError:
        return None
