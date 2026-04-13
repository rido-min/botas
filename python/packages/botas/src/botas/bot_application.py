from __future__ import annotations

from typing import Any, Awaitable, Callable

from botas.conversation_client import ConversationClient
from botas.core_activity import CoreActivity, ResourceResponse
from botas.i_turn_middleware import ITurnMiddleware
from botas.token_manager import BotApplicationOptions, TokenManager
from botas.turn_context import TurnContext

ActivityHandler = Callable[[TurnContext], Awaitable[None]]


class BotHandlerException(Exception):
    """Wraps an exception thrown inside an activity handler."""

    def __init__(self, message: str, cause: BaseException, activity: CoreActivity) -> None:
        super().__init__(message)
        self.name = "BotHandlerException"
        self.cause = cause
        self.activity = activity
        self.__cause__ = cause


class BotApplication:
    def __init__(self, options: BotApplicationOptions = BotApplicationOptions()) -> None:
        self._token_manager = TokenManager(options)
        token_provider = self._token_manager.get_bot_token
        self.conversation_client = ConversationClient(token_provider)
        self._middlewares: list[ITurnMiddleware] = []
        self._handlers: dict[str, ActivityHandler] = {}

    @property
    def appid(self) -> str | None:
        """The bot application/client ID exposed from the token manager."""
        return self._token_manager.client_id

    def on(
        self,
        type: str,
        handler: ActivityHandler | None = None,
    ) -> Any:
        """Register a handler for an activity type.

        Can be used as a two-argument call or as a decorator:

            bot.on('message', my_handler)

            @bot.on('message')
            async def my_handler(activity): ...
        """
        if handler is None:
            def decorator(fn: ActivityHandler) -> ActivityHandler:
                self._handlers[type] = fn
                return fn
            return decorator
        self._handlers[type] = handler
        return self

    def use(self, middleware: ITurnMiddleware) -> "BotApplication":
        """Register a middleware in the turn pipeline."""
        self._middlewares.append(middleware)
        return self

    async def process_body(self, body: str) -> None:
        """Parse and process a raw JSON activity body."""
        activity = CoreActivity.model_validate_json(body)
        _assert_activity(activity)
        await self._run_pipeline(activity)

    async def send_activity_async(
        self,
        service_url: str,
        conversation_id: str,
        activity: CoreActivity | dict[str, Any],
    ) -> ResourceResponse | None:
        """Proactively send an activity to a conversation."""
        return await self.conversation_client.send_activity_async(
            service_url, conversation_id, activity
        )

    async def _handle_activity_async(self, context: TurnContext) -> None:
        handler = self._handlers.get(context.activity.type)
        if handler is None:
            return
        try:
            await handler(context)
        except Exception as exc:
            raise BotHandlerException(
                f'Handler for "{context.activity.type}" threw an error',
                exc,
                context.activity,
            ) from exc

    async def _run_pipeline(self, activity: CoreActivity) -> None:
        context = TurnContext(self, activity)
        index = 0

        async def next_fn() -> None:
            nonlocal index
            if index < len(self._middlewares):
                mw = self._middlewares[index]
                index += 1
                await mw.on_turn_async(context, next_fn)
            else:
                await self._handle_activity_async(context)

        await next_fn()


def _assert_activity(activity: CoreActivity) -> None:
    if not activity.type:
        raise ValueError("CoreActivity missing required field: type")
    if not activity.service_url:
        raise ValueError("CoreActivity missing required field: serviceUrl")
    if not activity.conversation or not activity.conversation.id:
        raise ValueError("CoreActivity missing required field: conversation.id")
