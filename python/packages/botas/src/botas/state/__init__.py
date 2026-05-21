"""State management for bot conversations, users, and turns.

Provides the :class:`TurnState` class with three scopes (conversation, user, temp),
the :class:`Storage` protocol for pluggable backends, and built-in implementations
(:class:`MemoryStorage`, :class:`FileStorage`).
"""

from __future__ import annotations

from botas.state.file_storage import FileStorage
from botas.state.memory_storage import MemoryStorage
from botas.state.state_scope import StateScope
from botas.state.storage import Storage
from botas.state.turn_state import TurnState

__all__ = [
    "Storage",
    "MemoryStorage",
    "FileStorage",
    "TurnState",
    "StateScope",
]
