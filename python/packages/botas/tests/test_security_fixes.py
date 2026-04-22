"""Tests for P1 security audit fixes.

Covers:
- #108: Auth error details not leaked
- #109: Timeouts on JWKS/OpenID metadata fetch
- #110: Request body size limit
- #111: SSRF serviceUrl validation
- #112: Malformed JSON returns 400

NOTE: These tests require the Python P1 audit fixes (PR #134).
They are skipped until that PR is merged.
"""

from unittest.mock import AsyncMock, patch

import pytest

# Check if Python P1 audit features are available
try:
    import inspect

    from botas.bot_application import BotApplication  # noqa: F401

    _src = inspect.getsource(BotApplication.process_body)
    _has_ssrf = "validate_service_url" in _src or "Invalid serviceUrl" in _src

    # Also need JWKS timeout and botas_fastapi for full P1 coverage
    from botas.bot_auth import _fetch_jwks_uri  # noqa: F401

    _jwks_src = inspect.getsource(_fetch_jwks_uri)
    _has_timeout = "timeout" in _jwks_src

    import botas_fastapi  # noqa: F401

    _HAS_P1_FIXES = _has_ssrf and _has_timeout
except (ImportError, OSError, AttributeError):
    _HAS_P1_FIXES = False

pytestmark = pytest.mark.skipif(not _HAS_P1_FIXES, reason="Requires Python P1 audit fixes (PR #134)")


class TestServiceUrlValidation:
    """Test #111: SSRF prevention via serviceUrl validation."""

    @pytest.mark.asyncio
    async def test_valid_botframework_urls(self):
        """Valid Bot Framework URLs should be accepted."""
        bot = BotApplication()
        valid_urls = [
            "https://api.botframework.com",
            "https://token.botframework.com",
            "https://smba.trafficmanager.net",
            "https://directline.botframework.com",
        ]
        for url in valid_urls:
            activity_json = f"""
            {{
                "type": "message",
                "serviceUrl": "{url}",
                "conversation": {{"id": "conv1"}},
                "text": "test"
            }}
            """
            await bot.process_body(activity_json)

    @pytest.mark.asyncio
    async def test_wildcard_trafficmanager_rejected(self):
        """Wildcard trafficmanager.net subdomains should be rejected (#207)."""
        bot = BotApplication()
        activity_json = """
        {
            "type": "message",
            "serviceUrl": "https://evil.trafficmanager.net",
            "conversation": {"id": "conv1"},
            "text": "test"
        }
        """
        with pytest.raises(ValueError, match="Invalid serviceUrl"):
            await bot.process_body(activity_json)

    @pytest.mark.asyncio
    async def test_invalid_urls_rejected(self):
        """Invalid or potentially malicious URLs should be rejected."""
        bot = BotApplication()
        invalid = [
            "https://evil.com",
            "https://attacker.com/api/botframework.com",
            "ftp://api.botframework.com",
            "javascript:alert(1)",
        ]
        for url in invalid:
            activity_json = f"""
            {{
                "type": "message",
                "serviceUrl": "{url}",
                "conversation": {{"id": "conv1"}},
                "text": "test"
            }}
            """
            with pytest.raises(ValueError, match="Invalid serviceUrl"):
                await bot.process_body(activity_json)

    @pytest.mark.asyncio
    async def test_invalid_service_url_rejected_in_process_body(self):
        bot = BotApplication()
        activity_json = """
        {
            "type": "message",
            "serviceUrl": "https://evil.com",
            "conversation": {"id": "conv1"},
            "text": "test"
        }
        """
        with pytest.raises(ValueError, match="Invalid serviceUrl"):
            await bot.process_body(activity_json)


class TestMalformedJsonHandling:
    """Test #112: Malformed JSON returns 400, not 500."""

    @pytest.mark.asyncio
    async def test_invalid_json_raises_value_error(self):
        bot = BotApplication()
        bad_json = "{this is not json"
        with pytest.raises(ValueError, match="Invalid JSON in request body"):
            await bot.process_body(bad_json)

    @pytest.mark.asyncio
    async def test_missing_required_fields_raises_value_error(self):
        bot = BotApplication()
        incomplete_json = '{"type": "message"}'
        with pytest.raises(ValueError):
            await bot.process_body(incomplete_json)


class TestAuthErrorLeakage:
    """Test #108: Auth errors log details but return generic message."""

    @pytest.mark.asyncio
    async def test_bot_auth_dependency_returns_generic_error(self):
        """Auth errors should not leak internal details to client."""
        from botas_fastapi.bot_auth import bot_auth_dependency
        from fastapi import HTTPException

        from botas.bot_auth import BotAuthError

        dependency = bot_auth_dependency("test-app-id")

        with patch(
            "botas_fastapi.bot_auth.validate_bot_token",
            side_effect=BotAuthError("Untrusted issuer: 'evil.com'"),
        ):
            with patch("botas_fastapi.bot_auth.logger") as mock_logger:
                with pytest.raises(HTTPException) as exc_info:
                    await dependency(authorization="Bearer fake-token")

                assert exc_info.value.status_code == 401
                assert exc_info.value.detail == "Unauthorized"
                mock_logger.warning.assert_called_once()
                call_str = str(mock_logger.warning.call_args)
                assert "Untrusted issuer" in call_str or "evil.com" in call_str


class TestJwksTimeout:
    """Test #109: JWKS/OpenID metadata fetch has timeout."""

    @pytest.mark.asyncio
    async def test_jwks_uri_fetch_has_timeout(self):
        """Ensure JWKS URI fetch uses timeout."""

        from botas.bot_auth import _fetch_jwks_uri

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.get = AsyncMock(
                return_value=AsyncMock(
                    raise_for_status=lambda: None, json=lambda: {"jwks_uri": "https://example.com/keys"}
                )
            )
            mock_client_class.return_value = mock_client

            await _fetch_jwks_uri()

            mock_client_class.assert_called_once_with(timeout=10.0)

    @pytest.mark.asyncio
    async def test_jwks_fetch_has_timeout(self):
        """Ensure JWKS fetch uses timeout."""

        from botas.bot_auth import _fetch_jwks

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.get = AsyncMock(
                return_value=AsyncMock(raise_for_status=lambda: None, json=lambda: {"keys": [{"kid": "key1"}]})
            )
            mock_client_class.return_value = mock_client

            await _fetch_jwks("https://example.com/keys")

            mock_client_class.assert_called_once_with(timeout=10.0)


class TestBodySizeLimit:
    """Test #110: Request body size limit prevents memory exhaustion."""

    @pytest.mark.asyncio
    async def test_large_body_rejected_in_fastapi(self):
        """Bodies over 1MB should be rejected with 400."""
        from botas_fastapi import BotApp

        app = BotApp(auth=False)
        fastapi_app = app._build_app()

        from fastapi.testclient import TestClient

        client = TestClient(fastapi_app)

        base = b'{"type":"message","serviceUrl":"https://api.botframework.com",'
        base += b'"conversation":{"id":"c1"},"text":"'
        padding = b"x" * (1024 * 1024 + 1)
        large_body = base + padding + b'"}'

        response = client.post("/api/messages", content=large_body)
        assert response.status_code == 400
        assert "too large" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_acceptable_body_size_allowed(self):
        """Bodies under 1MB should be accepted."""
        from botas_fastapi import BotApp

        app = BotApp(auth=False)
        bot_mock = AsyncMock()
        bot_mock.process_body = AsyncMock()
        bot_mock.appid = None
        bot_mock.aclose = AsyncMock()
        app.bot = bot_mock

        fastapi_app = app._build_app()

        from fastapi.testclient import TestClient

        client = TestClient(fastapi_app)

        small_body = (
            '{"type":"message","serviceUrl":"https://api.botframework.com","conversation":{"id":"c1"},"text":"hello"}'
        )

        response = client.post("/api/messages", content=small_body)
        assert response.status_code == 200
        bot_mock.process_body.assert_called_once()
