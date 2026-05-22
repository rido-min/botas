"""State scope implementation for conversation, user, and temp state."""

from __future__ import annotations

import json
from typing import Any, Optional, TypeVar

T = TypeVar("T")


class StateScope:
    """Key-value store for a single state scope (conversation, user, or temp).

    Each scope holds a dictionary of string keys to arbitrary values.
    Values are serialized to JSON for storage persistence.

    Example::

        scope = StateScope()
        scope.set("count", 5)
        count = scope.get("count", int)  # 5
        scope.has("count")  # True
        scope.delete("count")
        scope.get("count", int)  # None
    """

    def __init__(self, data: Optional[dict[str, Any]] = None) -> None:
        """Initialize a state scope.

        Args:
            data: Initial data dictionary. Defaults to empty dict.
        """
        self._data = data if data is not None else {}
        self._snapshot = json.dumps(self._data, sort_keys=True, ensure_ascii=False)

    def get(self, key: str, type_: type[T] = object) -> Optional[T]:  # noqa: ARG002
        """Get a value by key.

        Args:
            key: Key to retrieve.
            type_: Type hint for return value (not enforced at runtime).

        Returns:
            The value if it exists, else None.
        """
        return self._data.get(key)  # type: ignore

    def set(self, key: str, value: Any) -> None:
        """Set a value by key.

        Args:
            key: Key to set.
            value: Value to store.
        """
        self._data[key] = value

    def has(self, key: str) -> bool:
        """Check if a key exists.

        Args:
            key: Key to check.

        Returns:
            True if the key exists, False otherwise.
        """
        return key in self._data

    def delete(self, key: str) -> None:
        """Delete a key from the scope.

        Args:
            key: Key to delete. No error if key doesn't exist.
        """
        self._data.pop(key, None)

    def clear(self) -> None:
        """Clear all keys from the scope."""
        self._data.clear()

    def is_dirty(self) -> bool:
        """Check if the scope has been modified since load.

        Returns:
            True if the scope data has changed, False otherwise.
        """
        current = json.dumps(self._data, sort_keys=True, ensure_ascii=False)
        return current != self._snapshot

    def is_deleted(self) -> bool:
        """Check if the scope has been cleared (all keys removed).

        Returns:
            True if the scope is now empty and was non-empty at load.
        """
        return len(self._data) == 0 and self._snapshot != "{}"

    def to_dict(self) -> dict[str, Any]:
        """Export the scope data as a dictionary.

        Returns:
            Copy of the internal data dictionary.
        """
        return dict(self._data)
