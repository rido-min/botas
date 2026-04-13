from __future__ import annotations

from typing import TYPE_CHECKING, Awaitable, Callable, Protocol, runtime_checkable

if TYPE_CHECKING:
    from botas.turn_context import TurnContext

NextTurn = Callable[[], Awaitable[None]]


@runtime_checkable
class TurnMiddleware(Protocol):
    async def on_turn(
        self,
        context: "TurnContext",
        next: NextTurn,
    ) -> None: ...


# Backward-compatible alias
ITurnMiddleware = TurnMiddleware
