"""Middleware protocol for the Bot Framework turn pipeline.

Middleware intercepts every incoming activity before handler dispatch.
Implement the :class:`TurnMiddleware` protocol and register with
:meth:`BotApplication.use`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Awaitable, Callable, Protocol, runtime_checkable

if TYPE_CHECKING:
    from botas.turn_context import TurnContext

NextTurn = Callable[[], Awaitable[None]]
"""Type alias for the ``next`` callback passed to middleware.

Call ``await next()`` to continue the pipeline; skip it to short-circuit.
"""


@runtime_checkable
class TurnMiddleware(Protocol):
    """Protocol that all turn middleware must satisfy.

    Implement :meth:`on_turn` to intercept activities before they reach
    the registered handler.  Call ``await next()`` to pass control to the
    next middleware (or the handler if this is the last middleware).
    """

    async def on_turn(
        self,
        context: "TurnContext",
        next: NextTurn,
    ) -> None:
        """Process a turn and optionally delegate to the next middleware.

        Args:
            context: The current turn context with the incoming activity.
            next: Async callback to invoke the next middleware or handler.
        """
        ...


ITurnMiddleware = TurnMiddleware
"""Backward-compatible alias for :class:`TurnMiddleware`."""
