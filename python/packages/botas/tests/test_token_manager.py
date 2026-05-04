"""Tests for :class:`botas.token_manager.TokenManager`."""

from __future__ import annotations

import pytest

from botas.token_manager import BotApplicationOptions, TokenManager


# ── #340: Custom token factory return value validation ───────────────────────


class TestCustomFactoryValidation:
    async def test_factory_returning_empty_string_raises(self):
        async def factory(_scope: str, _tenant: str) -> str:
            return ""

        tm = TokenManager(BotApplicationOptions(token_factory=factory))
        with pytest.raises(ValueError, match="Custom token factory returned an invalid token"):
            await tm.get_bot_token()

    async def test_factory_returning_none_raises(self):
        async def factory(_scope: str, _tenant: str):
            return None

        tm = TokenManager(BotApplicationOptions(token_factory=factory))  # type: ignore[arg-type]
        with pytest.raises(ValueError, match="Custom token factory returned an invalid token"):
            await tm.get_bot_token()

    async def test_factory_returning_valid_token_succeeds(self):
        async def factory(_scope: str, _tenant: str) -> str:
            return "valid-token"

        tm = TokenManager(BotApplicationOptions(token_factory=factory))
        result = await tm.get_bot_token()
        assert result == "valid-token"
