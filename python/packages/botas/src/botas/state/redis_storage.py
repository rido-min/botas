"""Redis-backed storage implementation (opt-in extra)."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from redis.asyncio import Redis as AsyncRedis

_INSTALL_HINT = 'RedisStorage requires the redis extra. Install with: pip install "botas[redis]"'


class RedisStorage:
    """Redis-backed storage for bot state across multiple instances.

    Stores each state key as a JSON-encoded Redis string. Keys are written as
    ``<key_prefix><raw_key>`` without encoding, and operations use pipelined
    single-key commands for Redis Cluster compatibility.

    Example::

        from botas.state import RedisStorage

        storage = RedisStorage("redis://localhost:6379")
        await storage.write({"conversation/123": {"count": 5}})
        data = await storage.read(["conversation/123"])
        # data = {"conversation/123": {"count": 5}}
        await storage.aclose()

    Example::

        from botas.state import RedisStorage

        storage = RedisStorage("redis://localhost:6379", key_prefix="mybot:")

    Example::

        from botas.state import RedisStorage

        storage = RedisStorage(client=existing_client, key_prefix="mybot:")

    Args:
        url: Redis connection URL, such as ``"redis://localhost:6379"``.
        client: Existing ``redis.asyncio.Redis`` client. When provided, the
            storage will not close the client in :meth:`aclose`.
        key_prefix: Prefix to prepend to every Redis key. Defaults to ``"botas:"``.

    Raises:
        ValueError: If neither ``url`` nor ``client`` is provided, or both are provided.
        ImportError: If the ``redis`` package is not installed.
    """

    def __init__(
        self,
        url: Optional[str] = None,
        *,
        client: Optional["AsyncRedis"] = None,
        key_prefix: str = "botas:",
    ) -> None:
        """Initialize Redis storage.

        Args:
            url: Redis connection URL, such as ``"redis://localhost:6379"``.
            client: Existing ``redis.asyncio.Redis`` client. When provided, the
                storage will not close the client in :meth:`aclose`.
            key_prefix: Prefix to prepend to every Redis key. Defaults to ``"botas:"``.

        Raises:
            ValueError: If neither ``url`` nor ``client`` is provided, or both are provided.
            ImportError: If the ``redis`` package is not installed.
        """
        if url is None and client is None:
            raise ValueError("Provide either a Redis URL or an existing client.")
        if url is not None and client is not None:
            raise ValueError("Provide either url OR client, not both.")
        try:
            import redis.asyncio as _redis_asyncio
        except ImportError as e:
            raise ImportError(_INSTALL_HINT) from e

        self._key_prefix = key_prefix
        if client is not None:
            self._client = client
            self._owns_client = False
        else:
            self._client = _redis_asyncio.from_url(url, decode_responses=True)
            self._owns_client = True

    async def read(self, keys: list[str]) -> dict[str, object]:
        """Read items from storage.

        Uses pipelined per-key ``GET`` commands rather than ``MGET`` for Redis
        Cluster compatibility.

        Args:
            keys: Keys to read.

        Returns:
            Dictionary of key-value pairs that exist in storage.
            Missing keys are omitted from the result.
        """
        pipe = self._client.pipeline(transaction=False)
        for key in keys:
            pipe.get(self._key_prefix + key)
        values = await pipe.execute()

        result: dict[str, object] = {}
        for key, val in zip(keys, values):
            if val is not None:
                result[key] = json.loads(val)
        return result

    async def write(self, changes: dict[str, object]) -> None:
        """Write items to storage.

        Uses pipelined per-key ``SET`` commands for Redis Cluster compatibility.
        Values are serialized as JSON strings with UTF-8 characters preserved.

        Args:
            changes: Dictionary of key-value pairs to write.
        """
        pipe = self._client.pipeline(transaction=False)
        for key, value in changes.items():
            pipe.set(self._key_prefix + key, json.dumps(value, ensure_ascii=False))
        await pipe.execute()

    async def delete(self, keys: list[str]) -> None:
        """Delete items from storage.

        Uses pipelined per-key ``DEL`` commands rather than multi-key ``DEL`` for
        Redis Cluster compatibility.

        Args:
            keys: Keys to delete. Idempotent — no error if key doesn't exist.
        """
        pipe = self._client.pipeline(transaction=False)
        for key in keys:
            pipe.delete(self._key_prefix + key)
        await pipe.execute()

    async def aclose(self) -> None:
        """Close the underlying Redis connection if this storage owns it.

        Existing clients passed with ``client=`` are owned by the caller and are
        not closed by this method.
        """
        if self._owns_client:
            await self._client.aclose()

    async def __aenter__(self) -> "RedisStorage":
        """Enter the async context manager.

        Returns:
            This storage instance.
        """
        return self

    async def __aexit__(self, *args: object) -> None:
        """Exit the async context manager and close owned Redis connections.

        Args:
            *args: Exception details supplied by the async context manager protocol.
        """
        await self.aclose()
