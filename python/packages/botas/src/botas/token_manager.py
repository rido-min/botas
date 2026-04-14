from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Awaitable, Callable


@dataclass
class BotApplicationOptions:
    client_id: str | None = None
    client_secret: str | None = None
    tenant_id: str | None = None
    managed_identity_client_id: str | None = None
    token_factory: Callable[[str, str], Awaitable[str]] | None = None


_BOT_FRAMEWORK_SCOPE = "https://api.botframework.com/.default"


class TokenManager:
    def __init__(self, options: BotApplicationOptions = BotApplicationOptions()) -> None:
        self._client_id = options.client_id or os.environ.get("CLIENT_ID")
        self._client_secret = options.client_secret or os.environ.get("CLIENT_SECRET")
        self._tenant_id = options.tenant_id or os.environ.get("TENANT_ID")
        self._managed_identity_client_id = options.managed_identity_client_id or os.environ.get(
            "MANAGED_IDENTITY_CLIENT_ID"
        )
        self._token_factory = options.token_factory
        self._msal_app: object | None = None

    @property
    def client_id(self) -> str | None:
        """Returns the configured bot application/client ID."""
        return self._client_id

    async def get_bot_token(self) -> str | None:
        return await self._get_token(_BOT_FRAMEWORK_SCOPE)

    async def _get_token(self, scope: str) -> str | None:
        if self._token_factory:
            return await self._token_factory(scope, self._tenant_id or "common")

        if self._client_id and self._client_secret and self._tenant_id:
            return await asyncio.to_thread(self._acquire_client_credentials, scope)

        return None

    def _acquire_client_credentials(self, scope: str) -> str | None:
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
