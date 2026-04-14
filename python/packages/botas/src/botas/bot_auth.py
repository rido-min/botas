from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import httpx
import jwt
from jwt.algorithms import RSAAlgorithm  # type: ignore[attr-defined]

_logger = logging.getLogger(__name__)

_OPENID_METADATA_URL = "https://login.botframework.com/v1/.well-known/openid-configuration"
_VALID_ISSUERS = {"https://api.botframework.com"}
_VALID_ISSUER_PREFIX = "https://sts.windows.net/"

_jwks_uri: str | None = None
_jwks_keys: list[dict[str, Any]] = []
_jwks_lock = asyncio.Lock()
_jwks_refresh_task: asyncio.Task[list[dict[str, Any]]] | None = None


class BotAuthError(Exception):
    pass


async def _fetch_jwks_uri() -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.get(_OPENID_METADATA_URL)
        resp.raise_for_status()
        return resp.json()["jwks_uri"]


async def _fetch_jwks(jwks_uri: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_uri)
        resp.raise_for_status()
        return resp.json()["keys"]


async def _get_jwks(force_refresh: bool = False) -> list[dict[str, Any]]:
    """Get JWKS keys with single-flight refresh pattern.

    When multiple concurrent callers request a refresh, only one fetch occurs
    and all waiters share the result. This prevents DoS amplification from
    redundant JWKS fetches during cache misses.
    """
    global _jwks_uri, _jwks_keys, _jwks_refresh_task

    async with _jwks_lock:
        # If a refresh is already in progress, wait for it
        if _jwks_refresh_task is not None:
            _logger.debug("JWKS refresh already in progress, waiting...")
            return await _jwks_refresh_task

        # Return cached keys if available and not forcing refresh
        if _jwks_keys and not force_refresh:
            return _jwks_keys

        # Start a new refresh task
        async def _refresh() -> list[dict[str, Any]]:
            global _jwks_uri, _jwks_keys
            try:
                if _jwks_uri is None:
                    _jwks_uri = await _fetch_jwks_uri()
                _jwks_keys = await _fetch_jwks(_jwks_uri)
                _logger.debug("JWKS refreshed successfully, %d keys", len(_jwks_keys))
                return _jwks_keys
            finally:
                global _jwks_refresh_task
                _jwks_refresh_task = None

        _jwks_refresh_task = asyncio.create_task(_refresh())
        return await _jwks_refresh_task


async def validate_bot_token(auth_header: str | None, app_id: str | None = None) -> None:
    """Validate a Bot Framework JWT bearer token.

    Raises BotAuthError on any validation failure.
    """
    resolved_app_id = app_id or os.environ.get("CLIENT_ID")
    if not resolved_app_id:
        raise BotAuthError("CLIENT_ID not configured")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise BotAuthError("Missing or malformed Authorization header")

    token = auth_header[len("Bearer ") :]

    try:
        unverified = jwt.get_unverified_header(token)
    except jwt.exceptions.DecodeError as exc:
        raise BotAuthError("Invalid token header") from exc

    kid = unverified.get("kid")

    keys = await _get_jwks()
    matching = next((k for k in keys if k.get("kid") == kid), None)

    if matching is None:
        # Try refreshing JWKS once (key rollover)
        keys = await _get_jwks(force_refresh=True)
        matching = next((k for k in keys if k.get("kid") == kid), None)

    if matching is None:
        raise BotAuthError(f"No JWKS key found for kid={kid!r}")

    public_key = RSAAlgorithm.from_jwk(json.dumps(matching))

    try:
        claims = jwt.decode(
            token,
            public_key,  # type: ignore[arg-type]
            algorithms=["RS256"],
            audience=resolved_app_id,
        )
    except jwt.ExpiredSignatureError as exc:
        raise BotAuthError("Token has expired") from exc
    except jwt.InvalidAudienceError as exc:
        raise BotAuthError("Invalid audience") from exc
    except jwt.PyJWTError as exc:
        raise BotAuthError(f"Token validation failed: {exc}") from exc

    issuer: str = claims.get("iss", "")
    if issuer not in _VALID_ISSUERS and not issuer.startswith(_VALID_ISSUER_PREFIX):
        _logger.warning("Token rejected: untrusted issuer %r", issuer)
        raise BotAuthError("Invalid issuer")
