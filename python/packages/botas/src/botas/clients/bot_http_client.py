from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, TypeVar
from urllib.parse import urlencode

import httpx

TokenProvider = Callable[[], Awaitable[str | None]]

T = TypeVar("T")


@dataclass
class BotRequestOptions:
    operation_description: str = ""
    return_none_on_not_found: bool = False


class BotHttpError(Exception):
    def __init__(self, message: str, status_code: int, body: str = "") -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class BotHttpClient:
    def __init__(self, get_token: TokenProvider | None = None) -> None:
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

    def _build_url(
        self, base_url: str, endpoint: str, params: dict[str, str | None] | None
    ) -> str:
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
        opts = options or BotRequestOptions()
        url = self._build_url(base_url, endpoint, None)
        return await self._send("PUT", url, body, opts)

    async def delete(
        self,
        base_url: str,
        endpoint: str,
        options: BotRequestOptions | None = None,
    ) -> None:
        opts = options or BotRequestOptions()
        url = self._build_url(base_url, endpoint, None)
        await self._send("DELETE", url, None, opts)

    async def aclose(self) -> None:
        await self._client.aclose()
