"""Bot Framework JWT token validation for inbound requests.

Validates bearer tokens from both the Bot Framework channel service and
Azure AD / Entra ID.  See ``specs/inbound-auth.md`` for protocol details.
"""

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

_BOT_FRAMEWORK_ISSUER = "https://api.botframework.com"
_BOT_OPENID_METADATA_URL = "https://login.botframework.com/v1/.well-known/openid-configuration"
_VALID_ISSUER_PREFIX = "https://sts.windows.net/"

# Per-metadata-URL JWKS cache: {metadata_url: {"jwks_uri": str, "keys": list}}
_jwks_cache: dict[str, dict[str, Any]] = {}
_jwks_lock = asyncio.Lock()


class BotAuthError(Exception):
    """Raised when inbound JWT validation fails.

    Inspect the message for the specific reason (expired, bad audience, etc.).
    """

    pass


def _peek_claims(token: str) -> dict[str, str | None]:
    """Decode token payload without verification to inspect iss/tid/aud."""
    try:
        claims = jwt.decode(token, options={"verify_signature": False})
        aud = claims.get("aud")
        if isinstance(aud, list):
            aud = aud[0] if aud else None
        return {
            "iss": claims.get("iss"),
            "tid": claims.get("tid"),
            "aud": aud,
        }
    except jwt.PyJWTError:
        return {"iss": None, "tid": None, "aud": None}


def _resolve_metadata_url(iss: str | None, tid: str | None) -> str:
    """Select the OpenID metadata URL based on the token's issuer.

    Bot Framework tokens use the botframework.com metadata.
    Azure AD/Entra ID tokens use the tenant-specific metadata.
    """
    if iss == _BOT_FRAMEWORK_ISSUER:
        return _BOT_OPENID_METADATA_URL
    tenant_id = tid or "botframework.com"
    return f"https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration"


_ALLOWED_METADATA_PREFIXES = (
    "https://login.botframework.com/",
    "https://login.microsoftonline.com/",
)


def _is_allowed_metadata_url(url: str) -> bool:
    return any(url.startswith(prefix) for prefix in _ALLOWED_METADATA_PREFIXES)


def _valid_issuers(tid: str | None) -> list[str]:
    """Build the list of valid issuers for a given tenant ID."""
    issuers = [_BOT_FRAMEWORK_ISSUER]
    if tid:
        issuers.append(f"https://sts.windows.net/{tid}/")
        issuers.append(f"https://login.microsoftonline.com/{tid}/v2")
        issuers.append(f"https://login.microsoftonline.com/{tid}/v2.0")
    return issuers


async def _fetch_metadata(metadata_url: str) -> str:
    """Fetch the jwks_uri from an OpenID Connect metadata endpoint."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(metadata_url)
        resp.raise_for_status()
        return resp.json()["jwks_uri"]


async def _fetch_jwks(jwks_uri: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_uri)
        resp.raise_for_status()
        return resp.json()["keys"]


async def _get_jwks(metadata_url: str, force_refresh: bool = False) -> list[dict[str, Any]]:
    """Get JWKS keys for a given metadata URL with caching."""
    async with _jwks_lock:
        cached = _jwks_cache.get(metadata_url)
        if cached and cached.get("keys") and not force_refresh:
            return cached["keys"]

        jwks_uri = cached["jwks_uri"] if cached and cached.get("jwks_uri") else await _fetch_metadata(metadata_url)
        keys = await _fetch_jwks(jwks_uri)
        _jwks_cache[metadata_url] = {"jwks_uri": jwks_uri, "keys": keys}
        _logger.debug("JWKS refreshed for %s, %d keys", metadata_url, len(keys))
        return keys


async def validate_bot_token(auth_header: str | None, app_id: str | None = None) -> None:
    """Validate a Bot Framework or Entra ID JWT bearer token.

    Supports tokens from both the Bot Framework channel service and Azure
    AD / Entra ID.  The correct OpenID configuration is selected dynamically
    by inspecting the token's issuer claim (see ``specs/inbound-auth.md``).

    Args:
        auth_header: The full ``Authorization`` header value
            (e.g. ``"Bearer eyJ..."``).
        app_id: Expected audience (bot application / client ID).  Falls back
            to the ``CLIENT_ID`` environment variable when ``None``.

    Raises:
        BotAuthError: On any validation failure — missing header, expired
            token, bad audience, untrusted issuer, or missing JWKS key.
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

    # Peek at claims to determine issuer and select correct JWKS source
    peeked = _peek_claims(token)
    iss = peeked["iss"]
    tid = peeked["tid"]
    _logger.debug("Token issuer=%s tid=%s aud=%s", iss, tid, peeked["aud"])

    allowed_issuers = _valid_issuers(tid)
    if not iss or iss not in allowed_issuers:
        _logger.warning("Token rejected: untrusted issuer %r", iss)
        raise BotAuthError("Untrusted token issuer")

    metadata_url = _resolve_metadata_url(iss, tid)
    _logger.debug("Using OpenID metadata: %s", metadata_url)

    if not _is_allowed_metadata_url(metadata_url):
        _logger.warning("Rejected disallowed metadata URL: %s", metadata_url)
        raise BotAuthError("Untrusted token issuer")

    keys = await _get_jwks(metadata_url)
    matching = next((k for k in keys if k.get("kid") == kid), None)

    if matching is None:
        # Try refreshing JWKS once (key rollover)
        keys = await _get_jwks(metadata_url, force_refresh=True)
        matching = next((k for k in keys if k.get("kid") == kid), None)

    if matching is None:
        raise BotAuthError(f"No JWKS key found for kid={kid!r}")

    public_key = RSAAlgorithm.from_jwk(json.dumps(matching))

    allowed_audiences = [resolved_app_id, f"api://{resolved_app_id}", _BOT_FRAMEWORK_ISSUER]

    try:
        jwt.decode(
            token,
            public_key,  # type: ignore[arg-type]
            algorithms=["RS256"],
            audience=allowed_audiences,
            issuer=allowed_issuers,
        )
    except jwt.ExpiredSignatureError as exc:
        raise BotAuthError("Token has expired") from exc
    except jwt.InvalidAudienceError as exc:
        raise BotAuthError("Invalid audience") from exc
    except jwt.InvalidIssuerError as exc:
        raise BotAuthError("Invalid issuer") from exc
    except jwt.PyJWTError as exc:
        raise BotAuthError(f"Token validation failed: {exc}") from exc

    _logger.debug("Token validated successfully")
