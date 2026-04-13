"""Tests for security and reliability fixes (#108-#115)."""

import json
from unittest.mock import AsyncMock, patch

import pytest

from botas.bot_application import (
    MAX_BODY_SIZE,
    BotApplication,
    _validate_service_url,
)
from botas.bot_auth import (
    _AUTH_HTTP_TIMEOUT,
    _JWKS_MIN_REFRESH_INTERVAL,
    BotAuthError,
)
from botas.conversation_client import ConversationClient, _encode_path_param
from botas.turn_context import TurnContext


def _make_body(**overrides) -> str:
    data = {
        "type": "message",
        "id": "act1",
        "channelId": "msteams",
        "serviceUrl": "http://localhost",
        "from": {"id": "user1"},
        "recipient": {"id": "bot1"},
        "conversation": {"id": "conv1"},
        "text": "hello",
    }
    data.update(overrides)
    return json.dumps(data)


class TestAuthErrorSanitization:
    """#108 — Auth errors must not leak details to client."""

    async def test_kid_not_in_error_message(self):
        with pytest.raises(BotAuthError, match="Token validation failed") as exc_info:
            await _trigger_kid_not_found()
        assert "kid=" not in str(exc_info.value)

    async def test_issuer_not_in_error_message(self):
        with pytest.raises(BotAuthError, match="Token validation failed") as exc_info:
            await _trigger_bad_issuer()
        assert "evil.com" not in str(exc_info.value)

    async def test_expired_token_generic_message(self):
        with pytest.raises(BotAuthError, match="Token validation failed") as exc_info:
            await _trigger_expired_token()
        assert "expired" not in str(exc_info.value).lower()

    async def test_audience_error_generic_message(self):
        with pytest.raises(BotAuthError, match="Token validation failed") as exc_info:
            await _trigger_bad_audience()
        assert "audience" not in str(exc_info.value).lower()


class TestAuthHttpTimeout:
    """#109 — Auth HTTP requests must have a timeout."""

    def test_timeout_constant_is_set(self):
        assert _AUTH_HTTP_TIMEOUT == 10.0


class TestBodySizeLimit:
    """#110 — Request body must have a size limit."""

    def test_max_body_size_is_10mb(self):
        assert MAX_BODY_SIZE == 10 * 1024 * 1024

    async def test_rejects_oversized_body(self):
        bot = BotApplication()
        body = "x" * (MAX_BODY_SIZE + 1)
        with pytest.raises(ValueError, match="maximum size"):
            await bot.process_body(body)


class TestServiceUrlValidation:
    """#111 — serviceUrl must be validated against allowlist."""

    def test_allows_botframework_com(self):
        _validate_service_url("https://smba.trafficmanager.net.botframework.com")

    def test_allows_botframework_us(self):
        _validate_service_url("https://smba.botframework.us")

    def test_allows_localhost(self):
        _validate_service_url("http://localhost")
        _validate_service_url("http://127.0.0.1")

    def test_rejects_arbitrary_url(self):
        with pytest.raises(ValueError, match="Untrusted serviceUrl"):
            _validate_service_url("https://evil.com")

    def test_rejects_http_non_localhost(self):
        with pytest.raises(ValueError, match="Untrusted serviceUrl"):
            _validate_service_url("http://evil.com")

    async def test_process_body_rejects_bad_service_url(self):
        bot = BotApplication()
        body = _make_body(serviceUrl="https://evil.com")
        with pytest.raises(ValueError, match="Untrusted serviceUrl"):
            await bot.process_body(body)

    async def test_process_body_accepts_localhost(self):
        bot = BotApplication()
        received: list[TurnContext] = []

        async def handler(ctx: TurnContext):
            received.append(ctx)

        bot.on("message", handler)
        await bot.process_body(_make_body(serviceUrl="http://localhost"))
        assert len(received) == 1


class TestMalformedJsonHandling:
    """#112 — Malformed JSON must return clear error, not crash."""

    async def test_invalid_json_raises_value_error(self):
        bot = BotApplication()
        with pytest.raises(ValueError, match="Invalid JSON"):
            await bot.process_body("not json at all")

    async def test_empty_body_raises_value_error(self):
        bot = BotApplication()
        with pytest.raises(ValueError, match="Invalid JSON"):
            await bot.process_body("")

    async def test_truncated_json_raises_value_error(self):
        bot = BotApplication()
        with pytest.raises(ValueError, match="Invalid JSON"):
            await bot.process_body('{"type": "message"')


class TestJwksDedup:
    """#114 — Concurrent JWKS refreshes must be deduplicated."""

    def test_min_refresh_interval_exists(self):
        assert _JWKS_MIN_REFRESH_INTERVAL > 0


class TestPathParameterEncoding:
    """#115 — All path parameters must be URL-encoded."""

    def test_encode_conversation_id(self):
        assert _encode_path_param("conv;messageback") == "conv%3Bmessageback"

    def test_encode_activity_id(self):
        assert _encode_path_param("act/123") == "act%2F123"

    def test_encode_member_id(self):
        assert _encode_path_param("user@domain") == "user%40domain"

    def test_encode_special_chars(self):
        assert _encode_path_param("a b&c=d") == "a%20b%26c%3Dd"

    async def test_update_activity_encodes_activity_id(self):
        client = ConversationClient()
        client._http = AsyncMock()
        client._http.put = AsyncMock(return_value={"id": "r1"})

        await client.update_activity_async(
            "https://smba.botframework.com",
            "conv1",
            "act/special",
            {"type": "message", "text": "updated"},
        )

        call_args = client._http.put.call_args
        endpoint = call_args[0][1]
        assert "act%2Fspecial" in endpoint

    async def test_delete_activity_encodes_activity_id(self):
        client = ConversationClient()
        client._http = AsyncMock()
        client._http.delete = AsyncMock(return_value=None)

        await client.delete_activity_async("https://smba.botframework.com", "conv1", "act/special")

        call_args = client._http.delete.call_args
        endpoint = call_args[0][1]
        assert "act%2Fspecial" in endpoint

    async def test_get_member_encodes_member_id(self):
        client = ConversationClient()
        client._http = AsyncMock()
        client._http.get = AsyncMock(return_value={"id": "m1", "name": "User"})

        await client.get_conversation_member_async("https://smba.botframework.com", "conv1", "user@domain")

        call_args = client._http.get.call_args
        endpoint = call_args[0][1]
        assert "user%40domain" in endpoint

    async def test_delete_member_encodes_member_id(self):
        client = ConversationClient()
        client._http = AsyncMock()
        client._http.delete = AsyncMock(return_value=None)

        await client.delete_conversation_member_async("https://smba.botframework.com", "conv1", "user@domain")

        call_args = client._http.delete.call_args
        endpoint = call_args[0][1]
        assert "user%40domain" in endpoint


# --- Helpers for auth tests ---


async def _trigger_kid_not_found():
    """Simulate a token with a kid that doesn't exist in JWKS."""
    import botas.bot_auth as ba

    async def mock_get_jwks(force_refresh=False):
        return [{"kid": "existing-kid", "kty": "RSA"}]

    with (
        patch.object(ba, "_get_jwks", side_effect=mock_get_jwks),
        patch.dict("os.environ", {"CLIENT_ID": "test-app"}),
    ):
        # Create a fake token header with unknown kid
        import base64

        header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "kid": "unknown-kid"}).encode()).rstrip(b"=")
        payload = base64.urlsafe_b64encode(b"{}").rstrip(b"=")
        fake_token = f"{header.decode()}.{payload.decode()}.sig"
        await ba.validate_bot_token(f"Bearer {fake_token}")


async def _trigger_bad_issuer():
    """Simulate a valid token structure but with an untrusted issuer."""

    import botas.bot_auth as ba

    with patch.dict("os.environ", {"CLIENT_ID": "test-app"}):
        # Patch to skip JWKS and go straight to decode
        with patch.object(ba, "_get_jwks", return_value=[{"kid": "k1", "kty": "RSA"}]):
            # Patch RSAAlgorithm.from_jwk and jwt.decode to return claims with bad issuer
            with patch("botas.bot_auth.RSAAlgorithm.from_jwk", return_value="fake-key"):
                with patch(
                    "botas.bot_auth.jwt.decode",
                    return_value={"iss": "https://evil.com", "aud": "test-app"},
                ):
                    with patch(
                        "botas.bot_auth.jwt.get_unverified_header",
                        return_value={"kid": "k1", "alg": "RS256"},
                    ):
                        await ba.validate_bot_token("Bearer fake.token.here")


async def _trigger_expired_token():
    """Simulate an expired token."""
    import jwt as pyjwt

    import botas.bot_auth as ba

    with patch.dict("os.environ", {"CLIENT_ID": "test-app"}):
        with patch.object(ba, "_get_jwks", return_value=[{"kid": "k1", "kty": "RSA"}]):
            with patch("botas.bot_auth.RSAAlgorithm.from_jwk", return_value="fake-key"):
                with patch(
                    "botas.bot_auth.jwt.decode",
                    side_effect=pyjwt.ExpiredSignatureError("Token expired"),
                ):
                    with patch(
                        "botas.bot_auth.jwt.get_unverified_header",
                        return_value={"kid": "k1", "alg": "RS256"},
                    ):
                        await ba.validate_bot_token("Bearer fake.token.here")


async def _trigger_bad_audience():
    """Simulate a token with wrong audience."""
    import jwt as pyjwt

    import botas.bot_auth as ba

    with patch.dict("os.environ", {"CLIENT_ID": "test-app"}):
        with patch.object(ba, "_get_jwks", return_value=[{"kid": "k1", "kty": "RSA"}]):
            with patch("botas.bot_auth.RSAAlgorithm.from_jwk", return_value="fake-key"):
                with patch(
                    "botas.bot_auth.jwt.decode",
                    side_effect=pyjwt.InvalidAudienceError("Bad audience"),
                ):
                    with patch(
                        "botas.bot_auth.jwt.get_unverified_header",
                        return_value={"kid": "k1", "alg": "RS256"},
                    ):
                        await ba.validate_bot_token("Bearer fake.token.here")
