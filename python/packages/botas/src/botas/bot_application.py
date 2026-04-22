from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable
from urllib.parse import urlparse

from botas.conversation_client import ConversationClient
from botas.core_activity import CoreActivity, ResourceResponse
from botas.i_turn_middleware import TurnMiddleware
from botas.token_manager import BotApplicationOptions, TokenManager
from botas.turn_context import TurnContext

ActivityHandler = Callable[[TurnContext], Awaitable[None]]

_ALLOWED_SERVICE_URL_PATTERNS = [
    re.compile(r"^https://[^/]*\.botframework\.com(/|$)", re.IGNORECASE),
    re.compile(r"^https://[^/]*\.botframework\.us(/|$)", re.IGNORECASE),
    re.compile(r"^https://[^/]*\.botframework\.cn(/|$)", re.IGNORECASE),
    re.compile(r"^https://smba\.trafficmanager\.net(/|$)", re.IGNORECASE),
]


def _get_additional_allowed_urls() -> list[str]:
    """Parse ALLOWED_SERVICE_URLS env var (comma-separated URL prefixes)."""
    env_val = os.environ.get("ALLOWED_SERVICE_URLS", "")
    return [s.strip() for s in env_val.split(",") if s.strip()]


def _validate_service_url(service_url: str) -> None:
    """Validate serviceUrl against Bot Framework allowlist. Prevents SSRF."""
    try:
        parsed = urlparse(service_url)
    except Exception:
        raise ValueError(f"Invalid serviceUrl: {service_url}")
    if parsed.hostname in ("localhost", "127.0.0.1"):
        return
    if any(p.match(service_url) for p in _ALLOWED_SERVICE_URL_PATTERNS):
        return
    # Check additional URLs from ALLOWED_SERVICE_URLS env var
    lower = service_url.lower()
    if any(lower.startswith(prefix.lower()) for prefix in _get_additional_allowed_urls()):
        return
    raise ValueError(f"Invalid serviceUrl: {service_url}")


@dataclass
class InvokeResponse:
    """Response returned by an invoke activity handler.

    The ``status`` is written as the HTTP status code; ``body`` is serialized
    as JSON and included in the response body.
    """

    status: int
    """HTTP status code to return to the channel (e.g. 200, 400, 501)."""
    body: Any = field(default=None)
    """Optional response body serialized as JSON. Omitted when ``None``."""


InvokeActivityHandler = Callable[[TurnContext], Awaitable[InvokeResponse]]


class BotHandlerException(Exception):
    """Wraps an exception thrown inside an activity handler."""

    def __init__(self, message: str, cause: BaseException, activity: CoreActivity) -> None:
        super().__init__(message)
        self.name = "BotHandlerException"
        self.cause = cause
        self.activity = activity
        self.__cause__ = cause


class BotApplication:
    version: str = __import__("botas._version", fromlist=["__version__"]).__version__

    def __init__(self, options: BotApplicationOptions = BotApplicationOptions()) -> None:
        self._token_manager = TokenManager(options)
        token_provider = self._token_manager.get_bot_token
        self.conversation_client = ConversationClient(token_provider)
        self._middlewares: list[TurnMiddleware] = []
        self._handlers: dict[str, ActivityHandler] = {}
        self._invoke_handlers: dict[str, InvokeActivityHandler] = {}
        self.on_activity: ActivityHandler | None = None

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

    def use(self, middleware: TurnMiddleware) -> "BotApplication":
        """Register a middleware in the turn pipeline."""
        self._middlewares.append(middleware)
        return self

    def on_invoke(
        self,
        name: str,
        handler: InvokeActivityHandler | None = None,
    ) -> Any:
        """Register a handler for an invoke activity by its ``activity.name`` sub-type.

        The handler must return an :class:`InvokeResponse`.  Only one handler
        per name is supported; re-registering the same name replaces the
        previous handler.

        Can be used as a two-argument call or as a decorator::

            bot.on_invoke("adaptiveCard/action", my_handler)

            @bot.on_invoke("adaptiveCard/action")
            async def my_handler(ctx): ...
        """
        if handler is None:

            def decorator(fn: InvokeActivityHandler) -> InvokeActivityHandler:
                self._invoke_handlers[name] = fn
                return fn

            return decorator
        self._invoke_handlers[name] = handler
        return self

    async def process_body(self, body: str) -> InvokeResponse | None:
        """Parse and process a raw JSON activity body.

        For ``invoke`` activities, returns the :class:`InvokeResponse` produced
        by the registered handler (or a 501 response if none is registered).
        Returns ``None`` for all other activity types.
        """
        try:
            activity = CoreActivity.model_validate_json(body)
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid JSON in request body") from exc
        _assert_activity(activity)
        _validate_service_url(activity.service_url)
        return await self._run_pipeline(activity)

    async def send_activity_async(
        self,
        service_url: str,
        conversation_id: str,
        activity: CoreActivity | dict[str, Any],
    ) -> ResourceResponse | None:
        """Proactively send an activity to a conversation."""
        return await self.conversation_client.send_activity_async(service_url, conversation_id, activity)

    async def aclose(self) -> None:
        """Close the underlying HTTP client and release resources."""
        await self.conversation_client.aclose()

    async def __aenter__(self) -> "BotApplication":
        """Enter the async context manager."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit the async context manager, ensuring resources are closed."""
        await self.aclose()

    async def _handle_activity_async(self, context: TurnContext) -> InvokeResponse | None:
        if context.activity.type == "invoke":
            return await self._dispatch_invoke_async(context)
        handler = self.on_activity or self._handlers.get(context.activity.type)
        if handler is None:
            return None
        try:
            await handler(context)
        except Exception as exc:
            raise BotHandlerException(
                f'Handler for "{context.activity.type}" threw an error',
                exc,
                context.activity,
            ) from exc
        return None

    async def _dispatch_invoke_async(self, context: TurnContext) -> InvokeResponse:
        name = context.activity.name
        handler = self._invoke_handlers.get(name) if name else None
        if handler is None:
            return InvokeResponse(status=501)
        try:
            return await handler(context)
        except Exception as exc:
            raise BotHandlerException(
                f'Invoke handler for "{name}" threw an error',
                exc,
                context.activity,
            ) from exc

    async def _run_pipeline(self, activity: CoreActivity) -> InvokeResponse | None:
        context = TurnContext(self, activity)
        index = 0
        invoke_response: InvokeResponse | None = None

        async def next_fn() -> None:
            nonlocal index, invoke_response
            if index < len(self._middlewares):
                mw = self._middlewares[index]
                index += 1
                await mw.on_turn(context, next_fn)
            else:
                invoke_response = await self._handle_activity_async(context)

        await next_fn()
        return invoke_response


def _assert_activity(activity: CoreActivity) -> None:
    if not activity.type:
        raise ValueError("CoreActivity missing required field: type")
    if not activity.service_url:
        raise ValueError("CoreActivity missing required field: serviceUrl")
    if not activity.conversation or not activity.conversation.id:
        raise ValueError("CoreActivity missing required field: conversation.id")
