"""Authenticated HTTP client for Bot Framework REST API calls.

Wraps :class:`httpx.AsyncClient` with automatic bearer-token injection,
URL construction, and error handling.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, TypeVar
from urllib.parse import urlencode

import httpx

TokenProvider = Callable[[], Awaitable[str | None]]
"""Type alias for an async callable that returns a bearer token or ``None``."""

T = TypeVar("T")

_logger = logging.getLogger(__name__)


@dataclass
class BotRequestOptions:
    """Per-request options for :class:`BotHttpClient` calls.

    Attributes:
        operation_description: Human-readable label included in error messages.
        return_none_on_not_found: When ``True``, HTTP 404 responses return
            ``None`` instead of raising :class:`BotHttpError`.
    """

    operation_description: str = ""
    return_none_on_not_found: bool = False


class BotHttpError(Exception):
    """Raised when a Bot Framework REST API call returns a non-success status.

    Attributes:
        status_code: The HTTP status code from the response.
        body: The raw response body text (may be empty).
    """

    def __init__(self, message: str, status_code: int, body: str = "") -> None:
        """Initialise a BotHttpError.

        Args:
            message: Human-readable error description.
            status_code: HTTP status code from the failed request.
            body: Raw response body text.
        """
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class BotHttpClient:
    """Low-level async HTTP client with automatic Bot Framework authentication.

    Wraps :class:`httpx.AsyncClient` to inject bearer tokens, construct
    URLs, and translate HTTP errors into :class:`BotHttpError`.
    """

    def __init__(self, get_token: TokenProvider | None = None) -> None:
        """Initialise the HTTP client.

        Args:
            get_token: Async callable that returns a bearer token.  When
                ``None``, requests are sent without an ``Authorization`` header.
        """
        self._get_token = get_token
        self._client = httpx.AsyncClient(
            headers={"Content-Type": "application/json"},
            timeout=30.0,
        )

    async def _auth_headers(self) -> dict[str, str]:
        if self._get_token is None:
            return {}
        token = await self._get_token()
        if token is None:
            return {}
        return {"Authorization": f"Bearer {token}"}

    def _build_url(self, base_url: str, endpoint: str, params: dict[str, str | None] | None) -> str:
        url = base_url.rstrip("/") + endpoint
        if params:
            filtered = {k: v for k, v in params.items() if v is not None}
            if filtered:
                url += "?" + urlencode(filtered)
        return url

    async def _send(
        self,
        method: str,
        url: str,
        body: Any,
        options: BotRequestOptions,
    ) -> Any:
        # Warn if using unencrypted HTTP (production should use HTTPS)
        if url.startswith("http://"):
            _logger.warning("Outbound request uses insecure HTTP: %s", url)

        headers = await self._auth_headers()
        resp = await self._client.request(
            method,
            url,
            json=body,
            headers=headers,
        )
        if resp.status_code == 404 and options.return_none_on_not_found:
            return None
        if resp.status_code == 204:
            return None
        if not resp.is_success:
            raise BotHttpError(
                f"{options.operation_description} failed: HTTP {resp.status_code}",
                resp.status_code,
                resp.text,
            )
        if not resp.content:
            return None
        return resp.json()

    async def get(
        self,
        base_url: str,
        endpoint: str,
        params: dict[str, str | None] | None = None,
        options: BotRequestOptions | None = None,
    ) -> Any:
        """Send a GET request to the Bot Framework REST API.

        Args:
            base_url: The channel's service URL.
            endpoint: API path (e.g. ``/v3/conversations``).
            params: Optional query-string parameters (``None`` values omitted).
            options: Request options for error handling behaviour.

        Returns:
            Parsed JSON response, or ``None`` for 204 / 404 (when configured).

        Raises:
            BotHttpError: On non-success HTTP status codes.
        """
        opts = options or BotRequestOptions()
        url = self._build_url(base_url, endpoint, params)
        return await self._send("GET", url, None, opts)

    async def post(
        self,
        base_url: str,
        endpoint: str,
        body: Any,
        options: BotRequestOptions | None = None,
    ) -> Any:
        """Send a POST request to the Bot Framework REST API.

        Args:
            base_url: The channel's service URL.
            endpoint: API path.
            body: JSON-serializable request body.
            options: Request options for error handling behaviour.

        Returns:
            Parsed JSON response, or ``None`` for empty/204 responses.

        Raises:
            BotHttpError: On non-success HTTP status codes.
        """
        opts = options or BotRequestOptions()
        url = self._build_url(base_url, endpoint, None)
        return await self._send("POST", url, body, opts)

    async def put(
        self,
        base_url: str,
        endpoint: str,
        body: Any,
        options: BotRequestOptions | None = None,
    ) -> Any:
        """Send a PUT request to the Bot Framework REST API.

        Args:
            base_url: The channel's service URL.
            endpoint: API path.
            body: JSON-serializable request body.
            options: Request options for error handling behaviour.

        Returns:
            Parsed JSON response, or ``None`` for empty/204 responses.

        Raises:
            BotHttpError: On non-success HTTP status codes.
        """
        opts = options or BotRequestOptions()
        url = self._build_url(base_url, endpoint, None)
        return await self._send("PUT", url, body, opts)

    async def delete(
        self,
        base_url: str,
        endpoint: str,
        options: BotRequestOptions | None = None,
    ) -> None:
        """Send a DELETE request to the Bot Framework REST API.

        Args:
            base_url: The channel's service URL.
            endpoint: API path.
            options: Request options for error handling behaviour.

        Raises:
            BotHttpError: On non-success HTTP status codes.
        """
        opts = options or BotRequestOptions()
        url = self._build_url(base_url, endpoint, None)
        await self._send("DELETE", url, None, opts)

    async def aclose(self) -> None:
        """Close the underlying ``httpx.AsyncClient`` and release connections."""
        await self._client.aclose()
