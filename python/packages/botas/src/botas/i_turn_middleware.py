from __future__ import annotations

from typing import TYPE_CHECKING, Awaitable, Callable, Protocol, runtime_checkable

if TYPE_CHECKING:
    from botas.bot_application import BotApplication
    from botas.core_activity import CoreActivity

NextTurn = Callable[[], Awaitable[None]]


@runtime_checkable
class ITurnMiddleware(Protocol):
    async def on_turn_async(
        self,
        app: "BotApplication",
        activity: "CoreActivity",
        next: NextTurn,
    ) -> None: ...
