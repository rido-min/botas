"""State management for bot conversations, users, and turns.

Provides the :class:`TurnState` class with three scopes (conversation, user, temp),
the :class:`Storage` protocol for pluggable backends, and built-in implementations
(:class:`MemoryStorage`, :class:`FileStorage`, and lazy opt-in :class:`RedisStorage`).
"""

from __future__ import annotations

from botas.state.file_storage import FileStorage
from botas.state.memory_storage import MemoryStorage
from botas.state.state_scope import StateScope
from botas.state.storage import Storage
from botas.state.turn_state import TurnState


def __getattr__(name: str):
    """Lazily expose optional state providers."""
    if name == "RedisStorage":
        from botas.state.redis_storage import RedisStorage

        return RedisStorage
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "Storage",
    "MemoryStorage",
    "FileStorage",
    "RedisStorage",
    "TurnState",
    "StateScope",
]
