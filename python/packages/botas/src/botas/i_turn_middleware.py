from __future__ import annotations

from typing import TYPE_CHECKING, Awaitable, Callable, Protocol, runtime_checkable

if TYPE_CHECKING:
    from botas.turn_context import TurnContext

NextTurn = Callable[[], Awaitable[None]]


@runtime_checkable
class ITurnMiddleware(Protocol):
    async def on_turn_async(
        self,
        context: "TurnContext",
        next: NextTurn,
    ) -> None: ...
