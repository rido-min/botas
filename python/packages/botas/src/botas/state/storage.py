"""Storage protocol for bot state persistence."""

from __future__ import annotations

from typing import Protocol


class Storage(Protocol):
    """Storage provider for reading/writing bot state.

    Implementations provide pluggable backends (in-memory, file, cloud, etc.)
    for persisting bot state across turns.

    Example::

        from botas.state import MemoryStorage

        storage = MemoryStorage()
        await storage.write({"conversation/123": {"count": 5}})
        data = await storage.read(["conversation/123"])
        # data = {"conversation/123": {"count": 5}}
    """

    async def read(self, keys: list[str]) -> dict[str, object]:
        """Read items from storage.

        Args:
            keys: Keys to read.

        Returns:
            Dictionary of key-value pairs that exist in storage.
            Missing keys are omitted from the result.
        """
        ...

    async def write(self, changes: dict[str, object]) -> None:
        """Write items to storage.

        Args:
            changes: Dictionary of key-value pairs to write.
        """
        ...

    async def delete(self, keys: list[str]) -> None:
        """Delete items from storage.

        Args:
            keys: Keys to delete. Idempotent — no error if key doesn't exist.
        """
        ...
