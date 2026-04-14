"""Tests for P1 security audit fixes (#108, #109, #110, #111, #112)."""

from unittest.mock import patch

import pytest

from botas.bot_application import BotApplication


class TestServiceUrlValidation:
    """Test #111: SSRF prevention via serviceUrl validation."""

    @pytest.mark.asyncio
    async def test_valid_botframework_urls(self):
        """Valid Bot Framework URLs should be accepted."""
        bot = BotApplication()
        valid_urls = [
            "https://api.botframework.com",
            "https://token.botframework.com",
            "https://smba.trafficmanager.botframework.com",
            "https://directline.botframework.com",
            "https://webchat.botframework.us",
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
        pytest.importorskip("botas_fastapi", reason="botas_fastapi not installed")
        from botas_fastapi.bot_auth import bot_auth_dependency
        from fastapi import HTTPException

        from botas.bot_auth import BotAuthError

        dependency = bot_auth_dependency("test-app-id")

        with patch(
            "botas_fastapi.bot_auth.validate_bot_token",
            side_effect=BotAuthError("Untrusted issuer: 'evil.com'"),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await dependency(authorization="Bearer fake-token")

            assert exc_info.value.status_code == 401
            assert exc_info.value.detail == "Unauthorized"
