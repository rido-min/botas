from __future__ import annotations

from typing import Any, Awaitable, Callable

from botas.auth.token_manager import BotApplicationOptions, TokenManager
from botas.clients.conversation_client import ConversationClient
from botas.clients.user_token_client import UserTokenClient
from botas.middleware.i_turn_middleware import ITurnMiddleware
from botas.schema.activity import Activity, ResourceResponse

ActivityHandler = Callable[[Activity], Awaitable[None]]


class BotHandlerException(Exception):
    """Wraps an exception thrown inside an activity handler."""

    def __init__(self, message: str, cause: BaseException, activity: Activity) -> None:
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
        self.user_token_client = UserTokenClient(token_provider)
        self._middlewares: list[ITurnMiddleware] = []
        self._handlers: dict[str, ActivityHandler] = {}

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
        activity = Activity.model_validate_json(body)
        _assert_activity(activity)
        await self._run_pipeline(activity)

    async def send_activity_async(
        self,
        service_url: str,
        conversation_id: str,
        activity: Activity | dict[str, Any],
    ) -> ResourceResponse | None:
        """Proactively send an activity to a conversation."""
        return await self.conversation_client.send_activity_async(
            service_url, conversation_id, activity
        )

    async def _handle_activity_async(self, activity: Activity) -> None:
        handler = self._handlers.get(activity.type)
        if handler is None:
            return
        try:
            await handler(activity)
        except Exception as exc:
            raise BotHandlerException(
                f'Handler for "{activity.type}" threw an error',
                exc,
                activity,
            ) from exc

    async def _run_pipeline(self, activity: Activity) -> None:
        index = 0

        async def next_fn() -> None:
            nonlocal index
            if index < len(self._middlewares):
                mw = self._middlewares[index]
                index += 1
                await mw.on_turn_async(self, activity, next_fn)
            else:
                await self._handle_activity_async(activity)

        await next_fn()


def _assert_activity(activity: Activity) -> None:
    if not activity.type:
        raise ValueError("Activity missing required field: type")
    if not activity.service_url:
        raise ValueError("Activity missing required field: serviceUrl")
    if not activity.conversation or not activity.conversation.id:
        raise ValueError("Activity missing required field: conversation.id")
