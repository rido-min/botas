"""Tests for PostHog usage telemetry."""

from unittest.mock import MagicMock, patch

import pytest

from botas import _posthog_telemetry


@pytest.fixture(autouse=True)
def reset_telemetry_state():
    """Reset telemetry module state before each test."""
    _posthog_telemetry._client = None
    _posthog_telemetry._is_initialized = False
    _posthog_telemetry._is_disabled = False
    _posthog_telemetry._distinct_id = None
    _posthog_telemetry._bot_started_emitted = False
    yield
    _posthog_telemetry._client = None
    _posthog_telemetry._is_initialized = False
    _posthog_telemetry._is_disabled = False
    _posthog_telemetry._distinct_id = None
    _posthog_telemetry._bot_started_emitted = False


def test_distinct_id_from_client_id():
    """Test distinct_id derivation from CLIENT_ID env var (SHA-256, first 16 hex chars)."""
    import os

    # Temporarily set CLIENT_ID
    old_val = os.environ.get("CLIENT_ID")
    try:
        os.environ["CLIENT_ID"] = "test-client-id"
        distinct_id = _posthog_telemetry._get_distinct_id()
        assert len(distinct_id) == 16
        assert distinct_id == "8d4cdc7bc9400206"  # SHA-256("test-client-id")[:16]
    finally:
        if old_val is not None:
            os.environ["CLIENT_ID"] = old_val
        else:
            os.environ.pop("CLIENT_ID", None)


def test_distinct_id_anonymous_when_no_client_id():
    """Test distinct_id is 'botas-anonymous' when CLIENT_ID is not set."""
    import os

    old_val = os.environ.get("CLIENT_ID")
    try:
        os.environ.pop("CLIENT_ID", None)
        distinct_id = _posthog_telemetry._get_distinct_id()
        assert distinct_id == "botas-anonymous"
    finally:
        if old_val is not None:
            os.environ["CLIENT_ID"] = old_val


def test_common_properties():
    """Test common properties include sdk_language, sdk_version, runtime_version."""
    props = _posthog_telemetry._get_common_properties()
    assert props["sdk_language"] == "python"
    assert "sdk_version" in props
    assert props["runtime_version"].startswith("Python 3.")


def test_channel_type_sanitization():
    """Test channel_id is sanitized to known types."""
    assert _posthog_telemetry._get_channel_type("emulator") == "emulator"
    assert _posthog_telemetry._get_channel_type("Emulator") == "emulator"
    assert _posthog_telemetry._get_channel_type("msteams") == "msteams"
    assert _posthog_telemetry._get_channel_type("webchat") == "webchat"
    assert _posthog_telemetry._get_channel_type("slack") == "other"
    assert _posthog_telemetry._get_channel_type(None) == "other"


def test_telemetry_disabled_when_no_api_key(monkeypatch):
    """Test telemetry is disabled when POSTHOG_API_KEY is not set."""
    monkeypatch.delenv("POSTHOG_API_KEY", raising=False)
    _posthog_telemetry.track_event("test/event", {})
    assert _posthog_telemetry._is_disabled is True
    assert _posthog_telemetry._client is None


def test_telemetry_disabled_when_api_key_empty(monkeypatch):
    """Test telemetry is disabled when POSTHOG_API_KEY is empty."""
    monkeypatch.setenv("POSTHOG_API_KEY", "")
    _posthog_telemetry.track_event("test/event", {})
    assert _posthog_telemetry._is_disabled is True
    assert _posthog_telemetry._client is None


def test_telemetry_disabled_when_posthog_not_installed(monkeypatch):
    """Test telemetry is disabled when posthog package is not available."""
    monkeypatch.setenv("POSTHOG_API_KEY", "test-key")
    with patch.dict("sys.modules", {"posthog": None}):
        with patch("builtins.__import__", side_effect=ImportError("No module named 'posthog'")):
            _posthog_telemetry.track_event("test/event", {})
    assert _posthog_telemetry._is_disabled is True
    assert _posthog_telemetry._client is None


def test_telemetry_initializes_client(monkeypatch):
    """Test PostHog client is initialized when API key is set."""
    monkeypatch.setenv("POSTHOG_API_KEY", "test-key")
    monkeypatch.setenv("POSTHOG_HOST", "https://test.posthog.com")
    monkeypatch.setenv("CLIENT_ID", "test-client")

    mock_posthog_class = MagicMock()
    mock_client = MagicMock()
    mock_posthog_class.return_value = mock_client

    with patch.dict("sys.modules", {"posthog": MagicMock(Posthog=mock_posthog_class)}):
        _posthog_telemetry.track_event("test/event", {"key": "value"})

    # Verify client was created with correct config
    mock_posthog_class.assert_called_once_with(
        "test-key",
        host="https://test.posthog.com",
        disable_geoip=True,
        flush_interval=30.0,
        flush_at=20,
    )
    # Verify capture was called
    mock_client.capture.assert_called_once()
    call_args = mock_client.capture.call_args
    assert call_args[0][0] == "d5fe82513196ca97"  # distinct_id for "test-client"
    assert call_args[0][1] == "test/event"
    assert "key" in call_args[0][2]
    assert call_args[0][2]["key"] == "value"
    assert call_args[0][2]["sdk_language"] == "python"


def test_telemetry_uses_default_host(monkeypatch):
    """Test PostHog uses default host when POSTHOG_HOST is not set."""
    monkeypatch.setenv("POSTHOG_API_KEY", "test-key")
    monkeypatch.delenv("POSTHOG_HOST", raising=False)
    monkeypatch.setenv("CLIENT_ID", "test-client")

    mock_posthog_class = MagicMock()
    mock_client = MagicMock()
    mock_posthog_class.return_value = mock_client

    with patch.dict("sys.modules", {"posthog": MagicMock(Posthog=mock_posthog_class)}):
        _posthog_telemetry.track_event("test/event", {})

    # Verify default host is used
    call_args = mock_posthog_class.call_args
    assert call_args[1]["host"] == "https://us.i.posthog.com"


def test_track_bot_started(monkeypatch):
    """Test botas/bot_started event is emitted once per process."""
    monkeypatch.setenv("POSTHOG_API_KEY", "test-key")
    monkeypatch.setenv("CLIENT_ID", "test-client")

    mock_posthog_class = MagicMock()
    mock_client = MagicMock()
    mock_posthog_class.return_value = mock_client

    with patch.dict("sys.modules", {"posthog": MagicMock(Posthog=mock_posthog_class)}):
        # First call: emits event
        _posthog_telemetry.track_bot_started(
            handler_count=2,
            invoke_handler_count=1,
            middleware_count=3,
            has_catch_all=True,
            has_state_storage=False,
            auth_flow="client_credentials",
        )
        assert mock_client.capture.call_count == 1

        # Second call: no-op (already emitted)
        _posthog_telemetry.track_bot_started(
            handler_count=5,
            invoke_handler_count=2,
            middleware_count=4,
            has_catch_all=False,
            has_state_storage=True,
            auth_flow="managed_identity",
        )
        assert mock_client.capture.call_count == 1  # Still 1


def test_track_activity_received(monkeypatch):
    """Test botas/activity_received event is emitted with correct properties."""
    monkeypatch.setenv("POSTHOG_API_KEY", "test-key")
    monkeypatch.setenv("CLIENT_ID", "test-client")

    mock_posthog_class = MagicMock()
    mock_client = MagicMock()
    mock_posthog_class.return_value = mock_client

    with patch.dict("sys.modules", {"posthog": MagicMock(Posthog=mock_posthog_class)}):
        _posthog_telemetry.track_activity_received(
            activity_type="message",
            has_handler=True,
            channel_id="msteams",
        )

    call_args = mock_client.capture.call_args[0]
    assert call_args[1] == "botas/activity_received"
    props = call_args[2]
    assert props["activity_type"] == "message"
    assert props["has_handler"] is True
    assert props["channel_type"] == "msteams"


def test_track_handler_dispatched(monkeypatch):
    """Test botas/handler_dispatched event is emitted with correct properties."""
    monkeypatch.setenv("POSTHOG_API_KEY", "test-key")
    monkeypatch.setenv("CLIENT_ID", "test-client")

    mock_posthog_class = MagicMock()
    mock_client = MagicMock()
    mock_posthog_class.return_value = mock_client

    with patch.dict("sys.modules", {"posthog": MagicMock(Posthog=mock_posthog_class)}):
        _posthog_telemetry.track_handler_dispatched(
            activity_type="message",
            dispatch_mode="type",
            duration_ms=42,
        )

    call_args = mock_client.capture.call_args[0]
    assert call_args[1] == "botas/handler_dispatched"
    props = call_args[2]
    assert props["activity_type"] == "message"
    assert props["dispatch_mode"] == "type"
    assert props["duration_ms"] == 42


def test_track_handler_error(monkeypatch):
    """Test botas/handler_error event is emitted with correct properties."""
    monkeypatch.setenv("POSTHOG_API_KEY", "test-key")
    monkeypatch.setenv("CLIENT_ID", "test-client")

    mock_posthog_class = MagicMock()
    mock_client = MagicMock()
    mock_posthog_class.return_value = mock_client

    with patch.dict("sys.modules", {"posthog": MagicMock(Posthog=mock_posthog_class)}):
        _posthog_telemetry.track_handler_error(
            activity_type="message",
            error_type="ValueError",
        )

    call_args = mock_client.capture.call_args[0]
    assert call_args[1] == "botas/handler_error"
    props = call_args[2]
    assert props["activity_type"] == "message"
    assert props["error_type"] == "ValueError"


def test_track_outbound_sent(monkeypatch):
    """Test botas/outbound_sent event is emitted with correct properties."""
    monkeypatch.setenv("POSTHOG_API_KEY", "test-key")
    monkeypatch.setenv("CLIENT_ID", "test-client")

    mock_posthog_class = MagicMock()
    mock_client = MagicMock()
    mock_posthog_class.return_value = mock_client

    with patch.dict("sys.modules", {"posthog": MagicMock(Posthog=mock_posthog_class)}):
        _posthog_telemetry.track_outbound_sent(
            operation="send",
            success=True,
        )

    call_args = mock_client.capture.call_args[0]
    assert call_args[1] == "botas/outbound_sent"
    props = call_args[2]
    assert props["operation"] == "send"
    assert props["success"] is True


def test_telemetry_never_throws(monkeypatch):
    """Test telemetry calls never propagate exceptions."""
    monkeypatch.setenv("POSTHOG_API_KEY", "test-key")
    monkeypatch.setenv("CLIENT_ID", "test-client")

    mock_posthog_class = MagicMock()
    mock_client = MagicMock()
    # Simulate capture() raising an error
    mock_client.capture.side_effect = Exception("PostHog API error")
    mock_posthog_class.return_value = mock_client

    with patch.dict("sys.modules", {"posthog": MagicMock(Posthog=mock_posthog_class)}):
        # Should not raise
        _posthog_telemetry.track_event("test/event", {})


def test_telemetry_fire_and_forget(monkeypatch):
    """Test telemetry is fire-and-forget (no waiting, no blocking)."""
    monkeypatch.setenv("POSTHOG_API_KEY", "test-key")
    monkeypatch.setenv("CLIENT_ID", "test-client")

    mock_posthog_class = MagicMock()
    mock_client = MagicMock()
    mock_posthog_class.return_value = mock_client

    with patch.dict("sys.modules", {"posthog": MagicMock(Posthog=mock_posthog_class)}):
        _posthog_telemetry.track_event("test/event", {})

    # Capture is called synchronously (fire-and-forget)
    assert mock_client.capture.call_count == 1


def test_shutdown_flushes_client(monkeypatch):
    """Test _shutdown() flushes and shuts down the PostHog client."""
    monkeypatch.setenv("POSTHOG_API_KEY", "test-key")
    monkeypatch.setenv("CLIENT_ID", "test-client")

    mock_posthog_class = MagicMock()
    mock_client = MagicMock()
    mock_posthog_class.return_value = mock_client

    with patch.dict("sys.modules", {"posthog": MagicMock(Posthog=mock_posthog_class)}):
        _posthog_telemetry.track_event("test/event", {})
        # Manually invoke shutdown
        _posthog_telemetry._shutdown()

    mock_client.flush.assert_called_once()
    mock_client.shutdown.assert_called_once()


def test_shutdown_never_throws():
    """Test _shutdown() never throws even if flush/shutdown fail."""
    mock_client = MagicMock()
    mock_client.flush.side_effect = Exception("Flush error")
    mock_client.shutdown.side_effect = Exception("Shutdown error")
    _posthog_telemetry._client = mock_client

    # Should not raise
    _posthog_telemetry._shutdown()
