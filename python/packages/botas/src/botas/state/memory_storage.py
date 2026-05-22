"""In-memory storage implementation for development and testing."""

from __future__ import annotations

import asyncio
import copy
from typing import Optional


class MemoryStorage:
    """In-process dictionary-backed storage for bot state.

    Thread-safe for single-process use. Data is lost when the process exits.
    Suitable for development, testing, and single-instance bots.

    Example::

        from botas.state import MemoryStorage

        storage = MemoryStorage()
        await storage.write({"key1": {"count": 5}})
        data = await storage.read(["key1"])
        # data = {"key1": {"count": 5}}
    """

    def __init__(self) -> None:
        """Initialize an empty in-memory storage."""
        self._store: dict[str, object] = {}
        self._lock: Optional[asyncio.Lock] = None

    def _get_lock(self) -> asyncio.Lock:
        """Lazy-init lock to avoid event loop issues during import."""
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def read(self, keys: list[str]) -> dict[str, object]:
        """Read items from storage.

        Args:
            keys: Keys to read.

        Returns:
            Dictionary of key-value pairs that exist in storage.
            Missing keys are omitted from the result.
            Values are deep-cloned to isolate per-turn mutations.
        """
        async with self._get_lock():
            return {k: copy.deepcopy(self._store[k]) for k in keys if k in self._store}

    async def write(self, changes: dict[str, object]) -> None:
        """Write items to storage.

        Args:
            changes: Dictionary of key-value pairs to write.
                Values are deep-cloned to isolate per-turn mutations.
        """
        async with self._get_lock():
            self._store.update({k: copy.deepcopy(v) for k, v in changes.items()})

    async def delete(self, keys: list[str]) -> None:
        """Delete items from storage.

        Args:
            keys: Keys to delete. Idempotent — no error if key doesn't exist.
        """
        async with self._get_lock():
            for key in keys:
                self._store.pop(key, None)
