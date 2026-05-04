"""OAuth2 token management for outbound Bot Service API calls.

Acquires and caches client-credentials tokens via MSAL and managed-identity
tokens via ``azure-identity`` for authenticating outbound REST API requests.
See ``specs/outbound-auth.md`` for details.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional

from botas.tracer_provider import get_tracer

_logger = logging.getLogger(__name__)


@dataclass
class BotApplicationOptions:
    """Configuration options for :class:`BotApplication` authentication.

    All fields are optional; when ``None``, values are read from environment
    variables (``CLIENT_ID``, ``CLIENT_SECRET``, ``TENANT_ID``,
    ``MANAGED_IDENTITY_CLIENT_ID``).

    Attributes:
        client_id: Azure AD application (bot) ID.
        client_secret: Azure AD client secret.
        tenant_id: Azure AD tenant ID (defaults to ``"common"``).
        managed_identity_client_id: Client ID for managed identity auth.
        token_factory: Custom async callable ``(scope, tenant) -> token``
            that bypasses MSAL entirely.
    """

    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    tenant_id: Optional[str] = None
    managed_identity_client_id: Optional[str] = None
    token_factory: Optional[Callable[[str, str], Awaitable[str]]] = None


_BOT_FRAMEWORK_SCOPE = "https://api.botframework.com/.default"


class TokenManager:
    """Acquires and caches OAuth2 tokens for outbound Bot Service API calls.

    Uses MSAL's ``ConfidentialClientApplication`` for client-credentials flow,
    or delegates to a custom ``token_factory`` if provided.
    """

    def __init__(self, options: BotApplicationOptions = BotApplicationOptions()) -> None:
        """Initialise the token manager.

        Args:
            options: Authentication configuration.  Falls back to environment
                variables when individual fields are ``None``.
        """
        self._client_id = options.client_id or os.environ.get("CLIENT_ID")
        self._client_secret = options.client_secret or os.environ.get("CLIENT_SECRET")
        self._tenant_id = options.tenant_id or os.environ.get("TENANT_ID")
        self._managed_identity_client_id = options.managed_identity_client_id or os.environ.get(
            "MANAGED_IDENTITY_CLIENT_ID"
        )
        self._token_factory = options.token_factory
        self._msal_app: Optional[object] = None
        self._mi_credential: Optional[Any] = None

    @property
    def client_id(self) -> Optional[str]:
        """Returns the configured bot application/client ID."""
        return self._client_id

    async def get_bot_token(self) -> Optional[str]:
        """Acquire a token for the Bot Service API scope.

        Returns:
            A bearer token string, or ``None`` if credentials are not configured.
        """
        return await self._get_token(_BOT_FRAMEWORK_SCOPE)

    async def _get_token(self, scope: str) -> Optional[str]:
        tracer = get_tracer()
        if tracer:
            with tracer.start_as_current_span("botas.auth.outbound") as span:
                span.set_attribute("auth.scope", scope)
                span.set_attribute(
                    "auth.token_endpoint",
                    f"https://login.microsoftonline.com/{self._tenant_id or 'common'}/oauth2/v2.0/token",
                )
                if self._token_factory:
                    span.set_attribute("auth.flow", "custom_factory")
                elif self._client_id and self._client_secret:
                    span.set_attribute("auth.flow", "client_credentials")
                elif self._managed_identity_client_id or self._client_id:
                    span.set_attribute("auth.flow", "managed_identity")
                span.set_attribute("auth.cache_hit", False)
                return await self._do_get_token(scope)
        return await self._do_get_token(scope)

    async def _do_get_token(self, scope: str) -> Optional[str]:
        if self._token_factory:
            result = await self._token_factory(scope, self._tenant_id or "common")
            if not result:
                raise ValueError("Custom token factory returned an invalid token (None or empty)")
            return result

        if self._client_id and self._client_secret and self._tenant_id:
            # MSAL is synchronous; offload to thread pool to avoid blocking the event loop
            return await asyncio.to_thread(self._acquire_client_credentials, scope)

        return None

    def _acquire_client_credentials(self, scope: str) -> Optional[str]:
        import msal  # type: ignore[import-untyped]

        if self._msal_app is None:
            authority = f"https://login.microsoftonline.com/{self._tenant_id}"
            self._msal_app = msal.ConfidentialClientApplication(
                self._client_id,
                authority=authority,
                client_credential=self._client_secret,
            )

        result = self._msal_app.acquire_token_for_client(scopes=[scope])  # type: ignore[union-attr]
        if result and "access_token" in result:
            return result["access_token"]
        return None

    async def _acquire_managed_identity(self, scope: str, client_id: str) -> Optional[str]:
        """Acquire a token using a user-assigned managed identity.

        Uses :class:`azure.identity.aio.ManagedIdentityCredential` under the
        hood.  Returns ``None`` and logs a warning when ``azure-identity`` is
        not installed or when token acquisition fails (e.g., when running
        outside an Azure environment that exposes the IMDS endpoint).
        """
        try:
            from azure.identity.aio import ManagedIdentityCredential
        except ImportError:
            _logger.error(
                "azure-identity is required for managed identity authentication; "
                "install with `pip install azure-identity`"
            )
            return None

        try:
            if self._mi_credential is None:
                self._mi_credential = ManagedIdentityCredential(client_id=client_id)
            access_token = await self._mi_credential.get_token(scope)
            return access_token.token
        except Exception as exc:  # noqa: BLE001 — surface a clean log + None to caller
            _logger.warning("Managed identity token acquisition failed: %s", exc)
            return None

    async def aclose(self) -> None:
        """Close the token manager and reset internal credential state.

        Call during application shutdown to release cached credentials and
        close the underlying ``azure-identity`` HTTP client (if any).
        """
        self._msal_app = None
        if self._mi_credential is not None:
            close = getattr(self._mi_credential, "close", None)
            if close is not None:
                try:
                    result = close()
                    if asyncio.iscoroutine(result):
                        await result
                except Exception as exc:  # noqa: BLE001
                    _logger.debug("Error closing managed identity credential: %s", exc)
            self._mi_credential = None
