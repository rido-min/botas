"""Tests for bot_auth P2 security fixes."""

import asyncio
from unittest.mock import MagicMock, patch

import pytest

from botas.bot_auth import BotAuthError, validate_bot_token


class TestIssuerSanitization:
    """Issue #113: Issuer value should not be leaked in error messages."""

    @pytest.mark.asyncio
    async def test_untrusted_issuer_does_not_leak_value_in_exception(self):
        """Error message should not include the issuer value."""
        mock_token = "mock.jwt.token"
        auth_header = f"Bearer {mock_token}"

        mock_jwk = {"kid": "test-kid", "kty": "RSA", "n": "test-modulus", "e": "AQAB"}

        with (
            patch("botas.bot_auth.jwt.get_unverified_header") as mock_header,
            patch("botas.bot_auth.jwt.decode") as mock_decode,
            patch("botas.bot_auth._get_jwks") as mock_jwks,
            patch("botas.bot_auth.RSAAlgorithm.from_jwk") as mock_rsa,
            patch.dict("os.environ", {"CLIENT_ID": "test-app-id"}),
        ):
            mock_header.return_value = {"kid": "test-kid"}
            mock_jwks.return_value = [mock_jwk]
            mock_rsa.return_value = MagicMock()
            mock_decode.return_value = {"iss": "https://evil.example.com", "aud": "test-app-id"}

            with pytest.raises(BotAuthError) as exc_info:
                await validate_bot_token(auth_header, app_id="test-app-id")

            error_msg = str(exc_info.value)
            assert "evil.example.com" not in error_msg, "Issuer value leaked"
            assert "Invalid issuer" in error_msg

    @pytest.mark.asyncio
    async def test_untrusted_issuer_logs_value_server_side(self):
        """Issuer should be logged server-side for debugging."""
        mock_token = "mock.jwt.token"
        auth_header = f"Bearer {mock_token}"

        mock_jwk = {"kid": "test-kid", "kty": "RSA", "n": "test-modulus", "e": "AQAB"}

        with (
            patch("botas.bot_auth.jwt.get_unverified_header") as mock_header,
            patch("botas.bot_auth.jwt.decode") as mock_decode,
            patch("botas.bot_auth._get_jwks") as mock_jwks,
            patch("botas.bot_auth.RSAAlgorithm.from_jwk") as mock_rsa,
            patch("botas.bot_auth._logger") as mock_logger,
            patch.dict("os.environ", {"CLIENT_ID": "test-app-id"}),
        ):
            mock_header.return_value = {"kid": "test-kid"}
            mock_jwks.return_value = [mock_jwk]
            mock_rsa.return_value = MagicMock()
            mock_decode.return_value = {"iss": "https://evil.example.com", "aud": "test-app-id"}

            with pytest.raises(BotAuthError):
                await validate_bot_token(auth_header, app_id="test-app-id")

            mock_logger.warning.assert_called_once()
            call_args = mock_logger.warning.call_args[0]
            assert "evil.example.com" in str(call_args)


class TestJWKSSingleFlight:
    """Issue #114: Concurrent JWKS refreshes should be coalesced."""

    @pytest.mark.asyncio
    async def test_concurrent_jwks_refresh_triggers_only_one_fetch(self):
        """Multiple concurrent cache misses should trigger only one fetch."""
        import botas.bot_auth

        fetch_count = 0

        async def mock_fetch_jwks(uri: str):
            nonlocal fetch_count
            fetch_count += 1
            await asyncio.sleep(0.1)
            return [{"kid": "test-key", "kty": "RSA", "n": "...", "e": "AQAB"}]

        # Reset state
        botas.bot_auth._jwks_keys = []
        botas.bot_auth._jwks_uri = None
        botas.bot_auth._jwks_refresh_task = None
        botas.bot_auth._jwks_lock = asyncio.Lock()

        with (
            patch("botas.bot_auth._fetch_jwks_uri", return_value="https://example.com/jwks"),
            patch("botas.bot_auth._fetch_jwks", side_effect=mock_fetch_jwks),
        ):
            tasks = [asyncio.create_task(botas.bot_auth._get_jwks(force_refresh=False)) for _ in range(5)]
            results = await asyncio.gather(*tasks)

            assert all(len(r) == 1 for r in results)
            assert fetch_count == 1, f"Expected 1 fetch, got {fetch_count}"
