from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, Optional

from botas.i_turn_middleware import TurnMiddleware
from botas.turn_context import TurnContext


class StateMiddleware(TurnMiddleware):
    """Middleware for managing turn state.

    Loads state at the beginning of a turn and saves it at the end if the
    turn completed successfully.
    """

    def __init__(self, storage: Any):
        """Initialise the state middleware.

        Args:
            storage: A storage implementation (MemoryStorage, FileStorage, etc.).
        """
        self._storage = storage
        self._state_locks: dict[tuple[str, str], asyncio.Lock] = {}

    async def _get_lock(self, conversation_key: str, user_key: str) -> asyncio.Lock:
        composite_key = (conversation_key, user_key)
        lock = self._state_locks.get(composite_key)
        if lock is None:
            lock = asyncio.Lock()
            self._state_locks[composite_key] = lock
        return lock

    async def on_turn(self, context: TurnContext, next: Callable[[], Awaitable[None]]) -> None:  # noqa: A003
        from botas.state.turn_state import TurnState

        conversation_key = TurnState.derive_conversation_key(context.activity)
        user_key = TurnState.derive_user_key(context.activity)

        async with await self._get_lock(conversation_key, user_key):
            loaded = await self._storage.read([conversation_key, user_key])
            state = TurnState(
                context.activity,
                loaded.get(conversation_key),  # type: ignore[arg-type]
                loaded.get(user_key),  # type: ignore[arg-type]
            )
            context.state = state

            await next()

            changes = {}
            deletions = []

            if state.conversation.is_deleted():
                deletions.append(conversation_key)
            elif state.conversation.is_dirty():
                changes[conversation_key] = state.conversation.to_dict()

            if state.user.is_deleted():
                deletions.append(user_key)
            elif state.user.is_dirty():
                changes[user_key] = state.user.to_dict()

            if changes:
                await self._storage.write(changes)
            if deletions:
                await self._storage.delete(deletions)
