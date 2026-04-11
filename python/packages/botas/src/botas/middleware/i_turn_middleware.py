from __future__ import annotations
from typing import TYPE_CHECKING, Awaitable, Callable, Protocol, runtime_checkable

if TYPE_CHECKING:
    from botas.app.bot_application import BotApplication
    from botas.schema.activity import Activity

NextTurn = Callable[[], Awaitable[None]]


@runtime_checkable
class ITurnMiddleware(Protocol):
    async def on_turn_async(
        self,
        app: "BotApplication",
        activity: "Activity",
        next: NextTurn,
    ) -> None: ...
