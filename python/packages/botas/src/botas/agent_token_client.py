"""Entra Agent ID token acquisition via raw HTTP (3-step token exchange).

Acquires user-delegated tokens without MSAL dependency, for structural parity
with the .NET and Node.js implementations.

See: https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-user-oauth-flow
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Optional

import httpx

_logger = logging.getLogger(__name__)

_FMI_EXCHANGE_SCOPE = "api://AzureADTokenExchange/.default"
_JWT_BEARER_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
_CACHE_TTL_SECONDS = 300  # 5 minutes


@dataclass
class AgenticIdentity:
    """Value object representing agentic identity fields from a Conversation.

    When present, indicates outbound calls should use the agentic token flow
    (user-delegated token via Entra Agent ID) instead of standard client credentials.

    Attributes:
        agentic_app_id: The Agent Identity's application ID (dual-purpose: fmi_path in step 1, client_id in steps 2-3).
        agentic_user_id: The user OID the agent is acting as.
        agentic_app_blueprint_id: The Blueprint's application ID.
    """

    agentic_app_id: str
    agentic_user_id: str
    agentic_app_blueprint_id: Optional[str] = None

    @staticmethod
    def from_conversation(conversation: object | None) -> Optional["AgenticIdentity"]:
        """Extract an AgenticIdentity from a Conversation if agentic fields are present.

        Args:
            conversation: A Conversation object (or any object with agentic_app_id/agentic_user_id attrs).

        Returns:
            An AgenticIdentity instance, or None if required fields are missing.
        """
        if conversation is None:
            return None

        app_id = getattr(conversation, "agentic_app_id", None)
        user_id = getattr(conversation, "agentic_user_id", None)

        if not app_id or not user_id:
            return None

        return AgenticIdentity(
            agentic_app_id=app_id,
            agentic_user_id=user_id,
            agentic_app_blueprint_id=getattr(conversation, "agentic_app_blueprint_id", None),
        )


@dataclass
class _CachedToken:
    access_token: str
    expires_at: float


class AgentTokenClient:
    """Acquires user-delegated tokens via the Entra Agent ID 3-step token exchange.

    Uses raw HTTP calls (httpx) - no MSAL dependency - for structural parity
    with the .NET and Node.js implementations.

    The flow:
        Step 1: Blueprint acquires FMI exchange token (T1) using fmi_path.
        Step 2: Agent Identity acquires impersonation token (T2) using T1 as client_assertion.
        Step 3: Agent Identity acquires resource token via user_fic grant with T1 + T2.

    Args:
        tenant_id: Azure AD tenant ID.
        client_id: Blueprint application (client) ID.
        client_secret: Blueprint client secret.
    """

    def __init__(self, tenant_id: str, client_id: str, client_secret: str) -> None:
        self._token_endpoint = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        self._client_id = client_id
        self._client_secret = client_secret
        self._cache: dict[str, _CachedToken] = {}
        self._http = httpx.AsyncClient()

    async def get_agent_user_token(self, agent_identity_id: str, agent_user_oid: str, scope: str) -> str:
        """Acquire a Bearer token for an agent acting as a specific user.

        Implements the 3-step agent user identity (user_fic) flow with built-in caching.

        Args:
            agent_identity_id: The Agent Identity ID (dual-purpose: fmi_path in step 1, client_id in steps 2-3).
            agent_user_oid: The user OID to impersonate.
            scope: Target resource scope (e.g. ``https://api.botframework.com/.default``).

        Returns:
            A string in the format ``"Bearer {token}"``.

        Raises:
            RuntimeError: When the token endpoint returns an error.
        """
        cache_key = f"{agent_identity_id}:{agent_user_oid}:{scope}"
        cached = self._cache.get(cache_key)

        if cached and time.time() < cached.expires_at:
            return f"Bearer {cached.access_token}"

        t1 = await self._step1_get_fmi_exchange_token(agent_identity_id)
        t2 = await self._step2_get_impersonation_token(agent_identity_id, t1)
        resource_response = await self._step3_get_resource_token(agent_identity_id, t1, t2, agent_user_oid, scope)

        expires_in = resource_response.get("expires_in")
        ttl = (int(expires_in) - 60) if expires_in else _CACHE_TTL_SECONDS

        self._cache[cache_key] = _CachedToken(
            access_token=resource_response["access_token"],
            expires_at=time.time() + ttl,
        )

        return f"Bearer {resource_response['access_token']}"

    async def _step1_get_fmi_exchange_token(self, agent_identity_id: str) -> str:
        """Step 1: Blueprint acquires FMI exchange token (T1) via fmi_path extension."""
        result = await self._post_token_request(
            {
                "grant_type": "client_credentials",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "scope": _FMI_EXCHANGE_SCOPE,
                "fmi_path": agent_identity_id,
            }
        )
        return result["access_token"]

    async def _step2_get_impersonation_token(self, agent_identity_id: str, t1: str) -> str:
        """Step 2: Agent Identity acquires impersonation token (T2) using T1 as client_assertion."""
        result = await self._post_token_request(
            {
                "grant_type": "client_credentials",
                "client_id": agent_identity_id,
                "client_assertion_type": _JWT_BEARER_TYPE,
                "client_assertion": t1,
                "scope": _FMI_EXCHANGE_SCOPE,
            }
        )
        return result["access_token"]

    async def _step3_get_resource_token(
        self, agent_identity_id: str, t1: str, t2: str, agent_user_oid: str, scope: str
    ) -> dict:
        """Step 3: Agent Identity acquires resource token via user_fic grant."""
        return await self._post_token_request(
            {
                "grant_type": "user_fic",
                "client_id": agent_identity_id,
                "client_assertion_type": _JWT_BEARER_TYPE,
                "client_assertion": t1,
                "user_federated_identity_credential": t2,
                "user_id": agent_user_oid,
                "requested_token_use": "on_behalf_of",
                "scope": scope,
            }
        )

    async def _post_token_request(self, params: dict[str, str]) -> dict:
        resp = await self._http.post(
            self._token_endpoint,
            data=params,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        data = resp.json()

        if not resp.is_success or "error" in data:
            error = data.get("error", "unknown_error")
            desc = data.get("error_description", "")
            _logger.error("Agentic token request failed (HTTP %d): %s - %s", resp.status_code, error, desc)
            raise RuntimeError(f"Agentic token request failed (HTTP {resp.status_code}): {error} - {desc}")

        return data

    async def aclose(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.aclose()
