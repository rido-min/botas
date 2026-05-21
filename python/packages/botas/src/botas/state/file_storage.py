"""File-based storage implementation using JSON files on disk."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Union
from urllib.parse import quote


class FileStorage:
    """JSON file-based storage for bot state.

    Stores each state key as a separate JSON file in a configurable directory.
    Keys are sanitized for filesystem safety. Suitable for single-instance
    deployments where simple persistence is needed.

    **Not suitable for multi-instance deployments** — no locking or concurrency control.

    Example::

        from botas.state import FileStorage

        storage = FileStorage("./bot-state")
        await storage.write({"conversation/123": {"count": 5}})
        data = await storage.read(["conversation/123"])
        # data = {"conversation/123": {"count": 5}}

    Args:
        root_path: Root directory for state files. Defaults to ``"./bot-state"``.
    """

    def __init__(self, root_path: Union[str, Path] = "./bot-state") -> None:
        """Initialize file storage with a root directory.

        Args:
            root_path: Root directory for state files. Defaults to ``"./bot-state"``.
        """
        self._root = Path(root_path)

    def _sanitize_key(self, key: str) -> str:
        """Sanitize a storage key for filesystem safety.

        Uses URL percent-encoding with no safe characters, ensuring
        cross-platform filesystem compatibility.

        Args:
            key: Raw storage key (e.g., "msteams/bot-id/conversations/conv-id").

        Returns:
            Filesystem-safe encoded key.
        """
        return quote(key, safe="")

    def _key_to_path(self, key: str) -> Path:
        """Convert a storage key to a file path.

        Args:
            key: Storage key.

        Returns:
            Absolute path to the JSON file for this key.
        """
        sanitized = self._sanitize_key(key)
        return self._root / f"{sanitized}.json"

    async def read(self, keys: list[str]) -> dict[str, object]:
        """Read items from storage.

        Args:
            keys: Keys to read.

        Returns:
            Dictionary of key-value pairs that exist in storage.
            Missing keys are omitted from the result.
        """
        result: dict[str, object] = {}
        for key in keys:
            path = self._key_to_path(key)
            try:
                # Use asyncio.to_thread to avoid blocking the event loop
                content = await asyncio.to_thread(path.read_text, encoding="utf-8")
                result[key] = json.loads(content)
            except FileNotFoundError:
                # Missing file is not an error — just omit from result
                pass
        return result

    async def write(self, changes: dict[str, object]) -> None:
        """Write items to storage.

        Creates parent directories if they don't exist.

        Args:
            changes: Dictionary of key-value pairs to write.
        """
        # Ensure root directory exists
        await asyncio.to_thread(self._root.mkdir, parents=True, exist_ok=True)

        for key, value in changes.items():
            path = self._key_to_path(key)
            content = json.dumps(value, ensure_ascii=False, indent=2)
            await asyncio.to_thread(path.write_text, content, encoding="utf-8")

    async def delete(self, keys: list[str]) -> None:
        """Delete items from storage.

        Args:
            keys: Keys to delete. Idempotent — no error if key doesn't exist.
        """
        for key in keys:
            path = self._key_to_path(key)
            try:
                await asyncio.to_thread(path.unlink)
            except FileNotFoundError:
                # Idempotent — no error if file doesn't exist
                pass
