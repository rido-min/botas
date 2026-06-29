"""PostHog usage telemetry for botas.

Anonymous, opt-in telemetry to understand SDK adoption and feature usage.
Completely disabled when POSTHOG_API_KEY is unset. No PII, no message text,
fire-and-forget.
"""

from __future__ import annotations

import atexit
import hashlib
import os
import sys
import threading
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from posthog import Posthog

_client: Optional[Posthog] = None
_is_initialized: bool = False
_is_disabled: bool = False
_lock = threading.Lock()
_distinct_id: Optional[str] = None
_bot_started_emitted: bool = False


def _get_distinct_id() -> str:
    """Derive distinct_id from CLIENT_ID env var using SHA-256 (first 16 hex chars)."""
    client_id = os.environ.get("CLIENT_ID", "").strip()
    if not client_id:
        return "botas-anonymous"
    return hashlib.sha256(client_id.encode("utf-8")).hexdigest()[:16]


def _get_common_properties() -> dict[str, Any]:
    """Return common event properties: sdk_language, sdk_version, runtime_version."""
    from botas._version import __version__

    python_version = f"Python {sys.version_info.major}.{sys.version_info.minor}"
    return {
        "sdk_language": "python",
        "sdk_version": __version__,
        "runtime_version": python_version,
    }


def _get_channel_type(channel_id: Optional[str]) -> str:
    """Sanitize channel_id into a known type: emulator, msteams, webchat, or other."""
    if not channel_id:
        return "other"
    lower = channel_id.lower()
    if lower == "emulator":
        return "emulator"
    if lower == "msteams":
        return "msteams"
    if lower == "webchat":
        return "webchat"
    return "other"


def _initialize_client() -> None:
    """Initialize PostHog client once, or set disabled flag if unavailable."""
    global _client, _is_initialized, _is_disabled, _distinct_id
    if _is_initialized:
        return

    _is_initialized = True
    api_key = os.environ.get("POSTHOG_API_KEY", "").strip()
    if not api_key:
        _is_disabled = True
        return

    try:
        from posthog import Posthog

        host = os.environ.get("POSTHOG_HOST", "https://eu.i.posthog.com").strip()
        _client = Posthog(
            api_key,
            host=host,
            # No IP-based geolocation
            disable_geoip=True,
            # Batch events, don't block
            flush_interval=30.0,
            flush_at=20,
        )
        # Compute distinct_id from CLIENT_ID env var
        _distinct_id = _get_distinct_id()
        # Register shutdown hook for best-effort flush
        atexit.register(_shutdown)
    except ImportError:
        _is_disabled = True
        _client = None


def _shutdown() -> None:
    """Flush buffered events on process exit."""
    global _client
    if _client is not None:
        try:
            _client.flush()
            _client.shutdown()
        except Exception:
            pass


def track_event(event_name: str, properties: dict[str, Any]) -> None:
    """Track a PostHog event with common properties. Fire-and-forget, never throws.

    Args:
        event_name: Event name (e.g., "botas/bot_started").
        properties: Event-specific properties.
    """
    global _is_disabled, _client, _distinct_id
    if _is_disabled:
        return

    with _lock:
        _initialize_client()
        if _is_disabled or _client is None or _distinct_id is None:
            return

    try:
        # Merge common properties
        merged = {**_get_common_properties(), **properties}
        _client.capture(_distinct_id, event_name, merged)
    except Exception:
        # Silently swallow telemetry errors
        pass


def track_bot_started(
    handler_count: int,
    invoke_handler_count: int,
    middleware_count: int,
    has_catch_all: bool,
    has_state_storage: bool,
    auth_flow: str,
) -> None:
    """Emit botas/bot_started event once per process lifetime."""
    global _bot_started_emitted
    if _bot_started_emitted:
        return
    _bot_started_emitted = True
    track_event(
        "botas/bot_started",
        {
            "handler_count": handler_count,
            "invoke_handler_count": invoke_handler_count,
            "middleware_count": middleware_count,
            "has_catch_all": has_catch_all,
            "has_state_storage": has_state_storage,
            "auth_flow": auth_flow,
        },
    )


def track_activity_received(
    activity_type: str,
    has_handler: bool,
    channel_id: Optional[str],
) -> None:
    """Emit botas/activity_received event once per turn."""
    track_event(
        "botas/activity_received",
        {
            "activity_type": activity_type,
            "has_handler": has_handler,
            "channel_type": _get_channel_type(channel_id),
        },
    )


def track_handler_dispatched(
    activity_type: str,
    dispatch_mode: str,
    duration_ms: int,
) -> None:
    """Emit botas/handler_dispatched event when a handler executes."""
    track_event(
        "botas/handler_dispatched",
        {
            "activity_type": activity_type,
            "dispatch_mode": dispatch_mode,
            "duration_ms": duration_ms,
        },
    )


def track_handler_error(
    activity_type: str,
    error_type: str,
) -> None:
    """Emit botas/handler_error event when a handler throws."""
    track_event(
        "botas/handler_error",
        {
            "activity_type": activity_type,
            "error_type": error_type,
        },
    )


def track_outbound_sent(
    operation: str,
    success: bool,
) -> None:
    """Emit botas/outbound_sent event when an outbound API call completes."""
    track_event(
        "botas/outbound_sent",
        {
            "operation": operation,
            "success": success,
        },
    )
