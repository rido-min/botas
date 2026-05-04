"""Tests for :mod:`botas.token_manager` outbound auth flow selection.

Covers the priority order documented in ``specs/outbound-auth.md``:

1. Custom token factory
2. Client credentials (``CLIENT_SECRET`` set)
3. Managed identity (``MANAGED_IDENTITY_CLIENT_ID`` or ``CLIENT_ID`` alone)
4. Otherwise ``None``
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from botas.token_manager import BotApplicationOptions, TokenManager


def _mk_access_token(value: str) -> Any:
    tok = MagicMock()
    tok.token = value
    return tok


class TestPriorityOrder:
    """Verify the auth flow selection precedence."""

    async def test_factory_takes_priority_over_managed_identity(self) -> None:
        factory = AsyncMock(return_value="factory-token")
        opts = BotApplicationOptions(
            token_factory=factory,
            managed_identity_client_id="mi-id",
            client_id="client-id",
        )
        tm = TokenManager(opts)

        with patch("azure.identity.aio.ManagedIdentityCredential") as mock_mi:
            token = await tm.get_bot_token()

        assert token == "factory-token"
        factory.assert_awaited_once()
        mock_mi.assert_not_called()

    async def test_factory_takes_priority_over_client_credentials(self) -> None:
        factory = AsyncMock(return_value="factory-token")
        opts = BotApplicationOptions(
            token_factory=factory,
            client_id="cid",
            client_secret="csec",
            tenant_id="tid",
        )
        tm = TokenManager(opts)

        with patch.object(tm, "_acquire_client_credentials") as mock_cc:
            token = await tm.get_bot_token()

        assert token == "factory-token"
        mock_cc.assert_not_called()

    async def test_client_credentials_take_priority_over_managed_identity(self) -> None:
        opts = BotApplicationOptions(
            client_id="cid",
            client_secret="csec",
            tenant_id="tid",
            managed_identity_client_id="mi-id",
        )
        tm = TokenManager(opts)

        with patch.object(tm, "_acquire_client_credentials", return_value="cc-token") as mock_cc, patch(
            "azure.identity.aio.ManagedIdentityCredential"
        ) as mock_mi:
            token = await tm.get_bot_token()

        assert token == "cc-token"
        mock_cc.assert_called_once()
        mock_mi.assert_not_called()


class TestManagedIdentity:
    """Verify managed-identity acquisition via ``azure-identity``."""

    async def test_managed_identity_client_id_uses_managed_identity_credential(self) -> None:
        opts = BotApplicationOptions(managed_identity_client_id="mi-id")
        tm = TokenManager(opts)

        mock_cred = MagicMock()
        mock_cred.get_token = AsyncMock(return_value=_mk_access_token("mi-token"))
        with patch("azure.identity.aio.ManagedIdentityCredential", return_value=mock_cred) as mock_ctor:
            token = await tm.get_bot_token()

        assert token == "mi-token"
        mock_ctor.assert_called_once_with(client_id="mi-id")
        mock_cred.get_token.assert_awaited_once_with("https://api.botframework.com/.default")

    async def test_falls_back_to_client_id_for_managed_identity(self) -> None:
        """When only ``CLIENT_ID`` is set (no secret, no MI override), MI flow uses CLIENT_ID."""
        opts = BotApplicationOptions(client_id="bot-client-id")
        tm = TokenManager(opts)

        mock_cred = MagicMock()
        mock_cred.get_token = AsyncMock(return_value=_mk_access_token("ua-mi-token"))
        with patch("azure.identity.aio.ManagedIdentityCredential", return_value=mock_cred) as mock_ctor:
            token = await tm.get_bot_token()

        assert token == "ua-mi-token"
        mock_ctor.assert_called_once_with(client_id="bot-client-id")

    async def test_managed_identity_credential_cached_across_calls(self) -> None:
        opts = BotApplicationOptions(managed_identity_client_id="mi-id")
        tm = TokenManager(opts)

        mock_cred = MagicMock()
        mock_cred.get_token = AsyncMock(return_value=_mk_access_token("mi-token"))
        with patch("azure.identity.aio.ManagedIdentityCredential", return_value=mock_cred) as mock_ctor:
            await tm.get_bot_token()
            await tm.get_bot_token()

        # Credential constructed exactly once; reused on subsequent calls
        assert mock_ctor.call_count == 1
        assert mock_cred.get_token.await_count == 2

    async def test_managed_identity_acquisition_failure_returns_none(self) -> None:
        opts = BotApplicationOptions(managed_identity_client_id="mi-id")
        tm = TokenManager(opts)

        mock_cred = MagicMock()
        mock_cred.get_token = AsyncMock(side_effect=RuntimeError("IMDS unreachable"))
        with patch("azure.identity.aio.ManagedIdentityCredential", return_value=mock_cred):
            token = await tm.get_bot_token()

        assert token is None


class TestClientCredentialsFallback:
    """When ``CLIENT_SECRET`` is set, MSAL is used regardless of MI configuration."""

    async def test_client_credentials_used_when_secret_provided(self) -> None:
        opts = BotApplicationOptions(client_id="cid", client_secret="csec", tenant_id="tid")
        tm = TokenManager(opts)

        with patch.object(tm, "_acquire_client_credentials", return_value="cc-token") as mock_cc:
            token = await tm.get_bot_token()

        assert token == "cc-token"
        mock_cc.assert_called_once_with("https://api.botframework.com/.default")


class TestNoCredentials:
    async def test_no_credentials_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("CLIENT_ID", raising=False)
        monkeypatch.delenv("CLIENT_SECRET", raising=False)
        monkeypatch.delenv("TENANT_ID", raising=False)
        monkeypatch.delenv("MANAGED_IDENTITY_CLIENT_ID", raising=False)
        tm = TokenManager(BotApplicationOptions())
        assert await tm.get_bot_token() is None


class TestEnvironmentVariables:
    async def test_managed_identity_client_id_read_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("CLIENT_ID", raising=False)
        monkeypatch.delenv("CLIENT_SECRET", raising=False)
        monkeypatch.setenv("MANAGED_IDENTITY_CLIENT_ID", "env-mi-id")

        tm = TokenManager(BotApplicationOptions())
        mock_cred = MagicMock()
        mock_cred.get_token = AsyncMock(return_value=_mk_access_token("env-token"))
        with patch("azure.identity.aio.ManagedIdentityCredential", return_value=mock_cred) as mock_ctor:
            token = await tm.get_bot_token()

        assert token == "env-token"
        mock_ctor.assert_called_once_with(client_id="env-mi-id")


class TestAclose:
    async def test_aclose_closes_managed_identity_credential(self) -> None:
        opts = BotApplicationOptions(managed_identity_client_id="mi-id")
        tm = TokenManager(opts)

        mock_cred = MagicMock()
        mock_cred.get_token = AsyncMock(return_value=_mk_access_token("mi-token"))
        mock_cred.close = AsyncMock()
        with patch("azure.identity.aio.ManagedIdentityCredential", return_value=mock_cred):
            await tm.get_bot_token()
            await tm.aclose()

        mock_cred.close.assert_awaited_once()
        assert tm._mi_credential is None
