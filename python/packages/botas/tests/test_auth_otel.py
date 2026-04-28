"""Tests for OpenTelemetry span instrumentation in auth modules."""

from __future__ import annotations

from typing import Sequence
from unittest.mock import AsyncMock, patch

import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ReadableSpan, SimpleSpanProcessor, SpanExporter, SpanExportResult

import botas.tracer_provider as tracer_mod
from botas.bot_auth import BotAuthError, validate_bot_token
from botas.token_manager import BotApplicationOptions, TokenManager


class _InMemoryExporter(SpanExporter):
    def __init__(self) -> None:
        self.spans: list[ReadableSpan] = []

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        self.spans.extend(spans)
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        pass

    def get_finished_spans(self) -> list[ReadableSpan]:
        return list(self.spans)


@pytest.fixture(autouse=True)
def _setup_otel(monkeypatch: pytest.MonkeyPatch):
    provider = TracerProvider()
    exporter = _InMemoryExporter()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("botas", "test")
    monkeypatch.setattr(tracer_mod, "_tracer", tracer)
    monkeypatch.setattr(tracer_mod, "_initialized", True)
    yield exporter
    monkeypatch.setattr(tracer_mod, "_tracer", None)
    monkeypatch.setattr(tracer_mod, "_initialized", False)


@pytest.fixture()
def exporter(_setup_otel: _InMemoryExporter) -> _InMemoryExporter:
    return _setup_otel


# --- Outbound auth spans (TokenManager) ---


class TestOutboundAuthSpan:
    async def test_custom_factory_flow(self, exporter: _InMemoryExporter):
        factory = AsyncMock(return_value="test-token")
        opts = BotApplicationOptions(token_factory=factory, tenant_id="my-tenant")
        tm = TokenManager(opts)
        token = await tm.get_bot_token()

        assert token == "test-token"
        spans = exporter.get_finished_spans()
        auth_spans = [s for s in spans if s.name == "botas.auth.outbound"]
        assert len(auth_spans) == 1
        attrs = dict(auth_spans[0].attributes or {})
        assert attrs["auth.flow"] == "custom_factory"
        assert attrs["auth.scope"] == "https://api.botframework.com/.default"
        assert "my-tenant" in attrs["auth.token_endpoint"]
        assert attrs["auth.cache_hit"] is False

    async def test_client_credentials_flow(self, exporter: _InMemoryExporter):
        opts = BotApplicationOptions(client_id="cid", client_secret="csec", tenant_id="tid")
        tm = TokenManager(opts)
        with patch.object(tm, "_acquire_client_credentials", return_value="cred-token"):
            token = await tm.get_bot_token()

        assert token == "cred-token"
        spans = exporter.get_finished_spans()
        auth_spans = [s for s in spans if s.name == "botas.auth.outbound"]
        assert len(auth_spans) == 1
        attrs = dict(auth_spans[0].attributes or {})
        assert attrs["auth.flow"] == "client_credentials"
        assert "tid" in attrs["auth.token_endpoint"]

    async def test_managed_identity_flow(self, exporter: _InMemoryExporter):
        opts = BotApplicationOptions(managed_identity_client_id="mi-id")
        tm = TokenManager(opts)
        # No factory and no client_id/secret, so _do_get_token returns None
        token = await tm.get_bot_token()

        assert token is None
        spans = exporter.get_finished_spans()
        auth_spans = [s for s in spans if s.name == "botas.auth.outbound"]
        assert len(auth_spans) == 1
        attrs = dict(auth_spans[0].attributes or {})
        assert attrs["auth.flow"] == "managed_identity"

    async def test_no_credentials_no_flow_attr(self, exporter: _InMemoryExporter):
        """When no credentials configured, span is still emitted but no flow attr."""
        opts = BotApplicationOptions()
        tm = TokenManager(opts)
        token = await tm.get_bot_token()

        assert token is None
        spans = exporter.get_finished_spans()
        auth_spans = [s for s in spans if s.name == "botas.auth.outbound"]
        assert len(auth_spans) == 1
        attrs = dict(auth_spans[0].attributes or {})
        assert "auth.scope" in attrs

    async def test_no_span_without_tracer(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(tracer_mod, "_tracer", None)
        monkeypatch.setattr(tracer_mod, "_initialized", True)
        factory = AsyncMock(return_value="tok")
        tm = TokenManager(BotApplicationOptions(token_factory=factory))
        token = await tm.get_bot_token()
        assert token == "tok"


# --- Inbound auth spans (validate_bot_token) ---


class TestInboundAuthSpan:
    async def test_inbound_span_on_valid_token(self, exporter: _InMemoryExporter):
        """Span records issuer, audience, kid on successful validation."""
        with patch("botas.bot_auth._do_validate_token", new_callable=AsyncMock) as mock_validate:
            await validate_bot_token("Bearer fake.jwt.token", app_id="my-app")

        spans = exporter.get_finished_spans()
        auth_spans = [s for s in spans if s.name == "botas.auth.inbound"]
        assert len(auth_spans) == 1
        # _do_validate_token was called with token, app_id, and span
        assert mock_validate.call_count == 1
        args = mock_validate.call_args
        assert args[0][0] == "fake.jwt.token"
        assert args[0][1] == "my-app"
        # span object was passed
        assert args[0][2] is not None

    async def test_inbound_span_attributes_set(self, exporter: _InMemoryExporter):
        """Full integration: span attributes set from token claims."""
        import jwt as pyjwt
        from cryptography.hazmat.primitives.asymmetric import rsa

        # Generate a test RSA key
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key = private_key.public_key()
        pub_numbers = public_key.public_numbers()

        import base64

        def _int_to_b64(n: int, length: int) -> str:
            return base64.urlsafe_b64encode(n.to_bytes(length, "big")).rstrip(b"=").decode()

        kid = "test-kid-123"
        jwk = {
            "kty": "RSA",
            "kid": kid,
            "n": _int_to_b64(pub_numbers.n, 256),
            "e": _int_to_b64(pub_numbers.e, 3),
            "use": "sig",
        }

        token = pyjwt.encode(
            {"iss": "https://api.botframework.com", "aud": "my-app", "tid": "t1"},
            private_key,
            algorithm="RS256",
            headers={"kid": kid},
        )

        with patch("botas.bot_auth._get_jwks", new_callable=AsyncMock, return_value=[jwk]):
            await validate_bot_token(f"Bearer {token}", app_id="my-app")

        spans = exporter.get_finished_spans()
        auth_spans = [s for s in spans if s.name == "botas.auth.inbound"]
        assert len(auth_spans) == 1
        attrs = dict(auth_spans[0].attributes or {})
        assert attrs["auth.issuer"] == "https://api.botframework.com"
        assert attrs["auth.audience"] == "my-app"
        assert attrs["auth.key_id"] == kid

    async def test_inbound_no_span_without_tracer(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(tracer_mod, "_tracer", None)
        monkeypatch.setattr(tracer_mod, "_initialized", True)
        with patch("botas.bot_auth._do_validate_token", new_callable=AsyncMock):
            await validate_bot_token("Bearer fake.jwt.token", app_id="my-app")

    async def test_inbound_missing_header_raises(self, exporter: _InMemoryExporter):
        with pytest.raises(BotAuthError, match="Missing"):
            await validate_bot_token(None, app_id="my-app")

    async def test_inbound_missing_app_id_raises(self, exporter: _InMemoryExporter, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("CLIENT_ID", raising=False)
        with pytest.raises(BotAuthError, match="CLIENT_ID"):
            await validate_bot_token("Bearer x", app_id=None)
