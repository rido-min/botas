from __future__ import annotations
import asyncio
import json
import os
from typing import Any

import httpx
import jwt
from jwt.algorithms import RSAAlgorithm  # type: ignore[attr-defined]

_OPENID_METADATA_URL = (
    "https://login.botframework.com/v1/.well-known/openid-configuration"
)
_VALID_ISSUERS = {"https://api.botframework.com"}
_VALID_ISSUER_PREFIX = "https://sts.windows.net/"

_jwks_uri: str | None = None
_jwks_keys: list[dict[str, Any]] = []
_jwks_lock = asyncio.Lock()


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
    global _jwks_uri, _jwks_keys
    async with _jwks_lock:
        if not _jwks_keys or force_refresh:
            if _jwks_uri is None:
                _jwks_uri = await _fetch_jwks_uri()
            _jwks_keys = await _fetch_jwks(_jwks_uri)
    return _jwks_keys


async def validate_bot_token(
    auth_header: str | None, app_id: str | None = None
) -> None:
    """Validate a Bot Framework JWT bearer token.

    Raises BotAuthError on any validation failure.
    """
    resolved_app_id = app_id or os.environ.get("CLIENT_ID")
    if not resolved_app_id:
        raise BotAuthError("CLIENT_ID not configured")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise BotAuthError("Missing or malformed Authorization header")

    token = auth_header[len("Bearer "):]

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
        raise BotAuthError(f"Untrusted issuer: {issuer!r}")


def bot_auth_dependency(app_id: str | None = None):
    """Return a FastAPI dependency that validates the Bot Framework JWT token.

    Usage:
        @app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
        async def messages(request: Request): ...
    """
    from fastapi import Header, HTTPException

    async def _dependency(authorization: str | None = Header(default=None)) -> None:
        try:
            await validate_bot_token(authorization, app_id)
        except BotAuthError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    return _dependency
