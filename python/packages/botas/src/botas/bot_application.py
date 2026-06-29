from __future__ import annotations

import json
import os
import re
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Awaitable, Callable, Generator, Optional, Union
from urllib.parse import urlparse

if TYPE_CHECKING:
    from opentelemetry.trace import Span

from botas.conversation_client import ConversationClient
from botas.core_activity import CoreActivity, ResourceResponse
from botas.i_turn_middleware import TurnMiddleware
from botas.meter_provider import get_metrics
from botas.token_manager import BotApplicationOptions, TokenManager
from botas.tracer_provider import get_tracer
from botas.turn_context import TurnContext

_ActivityHandler = Callable[[TurnContext], Awaitable[None]]
"""Type alias for an async activity handler: ``async def handler(ctx: TurnContext) -> None``."""


@contextmanager
def _span(name: str, **attributes: str | int) -> Generator[Span | None, None, None]:
    """Start an OTel span if a tracer is available, otherwise no-op."""
    tracer = get_tracer()
    if tracer:
        with tracer.start_as_current_span(name) as span:
            for k, v in attributes.items():
                span.set_attribute(k, v)
            yield span
    else:
        yield None


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
    """Validate serviceUrl against Bot Service allowlist. Prevents SSRF."""
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


_InvokeActivityHandler = Callable[[TurnContext], Awaitable[InvokeResponse]]


class BotHandlerException(Exception):
    """Wraps an exception thrown inside an activity handler.

    When an activity handler or invoke handler raises, the exception is
    caught by the pipeline and re-raised as a ``BotHandlerException`` with
    the original exception attached as ``cause`` and ``__cause__``.

    Attributes:
        name: Always ``"BotHandlerException"``.
        cause: The original exception raised by the handler.
        activity: The activity being processed when the error occurred.
    """

    def __init__(self, message: str, cause: BaseException, activity: CoreActivity) -> None:
        """Initialise a BotHandlerException.

        Args:
            message: Human-readable description of the failure.
            cause: The original exception raised by the handler.
            activity: The activity that was being processed.
        """
        super().__init__(message)
        self.name = "BotHandlerException"
        self.cause = cause
        self.activity = activity
        self.__cause__ = cause


class BotApplication:
    """Central entry point for building a bot with the Bot Service.

    Manages the middleware pipeline, activity handler dispatch, outbound
    messaging via :class:`ConversationClient`, and OAuth2 token lifecycle
    via :class:`TokenManager`.

    Supports async context-manager usage for automatic resource cleanup::

        async with BotApplication(options) as bot:
            bot.on("message", my_handler)
            ...

    Attributes:
        version: Library version string.
        conversation_client: Client for sending outbound activities.
        on_activity: Optional catch-all handler invoked for every activity type.
    """

    version: str = __import__("botas._version", fromlist=["__version__"]).__version__

    def __init__(self, options: BotApplicationOptions = BotApplicationOptions()) -> None:
        """Initialise the bot application.

        Args:
            options: Configuration for authentication credentials and token
                acquisition.  Defaults to reading from environment variables.
        """
        self._token_manager = TokenManager(options)
        token_provider = self._token_manager.get_bot_token
        self.conversation_client = ConversationClient(token_provider)
        self._middlewares: list[TurnMiddleware] = []
        self._handlers: dict[str, _ActivityHandler] = {}
        self._invoke_handlers: dict[str, _InvokeActivityHandler] = {}
        self.on_activity: Optional[_ActivityHandler] = None
        self._has_state_storage: bool = False

    @property
    def appid(self) -> Optional[str]:
        """The bot application/client ID exposed from the token manager."""
        return self._token_manager.client_id

    def on(
        self,
        type: str,
        handler: Optional[_ActivityHandler] = None,
    ) -> Any:
        """Register a handler for an activity type.

        Only one handler is stored per type; re-registering the same type
        replaces the previous handler.

        Can be used as a two-argument call or as a decorator::

            bot.on('message', my_handler)

            @bot.on('message')
            async def my_handler(ctx: TurnContext):
                await ctx.send("hello")

        Args:
            type: The activity type to handle (e.g. ``"message"``, ``"typing"``).
            handler: Async handler function.  If omitted, returns a decorator.

        Returns:
            The ``BotApplication`` instance when called with a handler, or a
            decorator function when called without one.
        """
        if handler is None:

            def decorator(fn: _ActivityHandler) -> _ActivityHandler:
                self._handlers[type.lower()] = fn
                return fn

            return decorator
        self._handlers[type.lower()] = handler
        return self

    def use(self, middleware: TurnMiddleware) -> "BotApplication":
        """Register a middleware in the turn pipeline.

        Middleware executes in registration order before handler dispatch.
        Each middleware receives ``(context, next)`` and must call ``next()``
        to continue the pipeline, or skip it to short-circuit processing.

        Args:
            middleware: An object implementing :class:`TurnMiddleware`.

        Returns:
            The ``BotApplication`` instance for chaining.
        """
        self._middlewares.append(middleware)
        return self

    def use_state(self, storage: Any) -> "BotApplication":
        """Enable turn state management with the given storage backend.

        Registers state middleware that loads state at turn start and saves
        dirty state at turn end (only if the turn completes successfully).

        Args:
            storage: A storage implementation (MemoryStorage, FileStorage, etc.).

        Returns:
            The ``BotApplication`` instance for chaining.

        Example::

            from botas.state import MemoryStorage

            bot = BotApplication()
            bot.use_state(MemoryStorage())
        """
        import asyncio

        from botas.state import TurnState

        # Per (conversation_key, user_key) lock so concurrent turns for the SAME
        # user/conversation serialize their load -> handler -> save sequence and
        # avoid lost updates (#365). Different users/conversations do not block
        # each other. Locks are created lazily under `pair_locks_guard`.
        pair_locks: dict[tuple[str, str], asyncio.Lock] = {}
        pair_locks_guard = asyncio.Lock()

        async def get_pair_lock(key_pair: tuple[str, str]) -> asyncio.Lock:
            async with pair_locks_guard:
                lock = pair_locks.get(key_pair)
                if lock is None:
                    lock = asyncio.Lock()
                    pair_locks[key_pair] = lock
                return lock

        async def state_middleware(context: TurnContext, next: Callable[[], Awaitable[None]]) -> None:
            # Load state at turn start
            conversation_key = TurnState.derive_conversation_key(context.activity)
            user_key = TurnState.derive_user_key(context.activity)
            keys = [conversation_key, user_key]

            # Acquire per (conv, user) lock so the load -> handler -> save sequence
            # is atomic against concurrent turns for the same key pair.
            pair_lock = await get_pair_lock((conversation_key, user_key))
            async with pair_lock:
                loaded = await storage.read(keys)
                conversation_data = loaded.get(conversation_key)
                user_data = loaded.get(user_key)

                # Initialize TurnState and attach to context
                context.state = TurnState(
                    context.activity,
                    conversation_data,  # type: ignore
                    user_data,  # type: ignore
                )

                # Call next and save state ONLY if no exception
                exception_raised = False
                try:
                    await next()
                except Exception:
                    exception_raised = True
                    raise
                finally:
                    if not exception_raised:
                        # Save dirty state
                        changes = {}
                        deletions = []

                        if context.state.conversation.is_deleted():
                            deletions.append(conversation_key)
                        elif context.state.conversation.is_dirty():
                            changes[conversation_key] = context.state.conversation.to_dict()

                        if context.state.user.is_deleted():
                            deletions.append(user_key)
                        elif context.state.user.is_dirty():
                            changes[user_key] = context.state.user.to_dict()

                        if changes:
                            await storage.write(changes)
                        if deletions:
                            await storage.delete(deletions)

        # Create a middleware object from the function
        class StateMiddleware:
            async def on_turn(self, context: TurnContext, next: Callable[[], Awaitable[None]]) -> None:  # noqa: A003
                await state_middleware(context, next)

        self._middlewares.append(StateMiddleware())
        self._has_state_storage = True
        return self

    def on_invoke(
        self,
        name: str,
        handler: Optional[_InvokeActivityHandler] = None,
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

            def decorator(fn: _InvokeActivityHandler) -> _InvokeActivityHandler:
                self._invoke_handlers[name.lower()] = fn
                return fn

            return decorator
        self._invoke_handlers[name.lower()] = handler
        return self

    async def process_body(self, body: str) -> Optional[InvokeResponse]:
        """Parse and process a raw JSON activity body.

        Deserializes the JSON string into a :class:`CoreActivity`, validates
        required fields and the ``serviceUrl``, then runs the full middleware
        pipeline followed by handler dispatch.

        For ``invoke`` activities, returns the :class:`InvokeResponse` produced
        by the registered handler, a 200 response if no invoke handlers are
        registered, or a 501 response if handlers exist but none match.
        Returns ``None`` for all other activity types.

        Args:
            body: Raw JSON string representing a Bot Service activity.

        Returns:
            An :class:`InvokeResponse` for invoke activities, or ``None``.

        Raises:
            ValueError: If the JSON is malformed or required activity fields
                are missing.
            BotHandlerException: If the matched handler raises an exception.
        """
        try:
            activity = CoreActivity.model_validate_json(body)
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid JSON in request body") from exc
        _assert_activity(activity)
        _validate_service_url(activity.service_url)

        # PostHog: botas/bot_started (once per process)
        from botas import _posthog_telemetry

        auth_flow = "none"
        if self._token_manager.client_id:
            auth_flow = "client_credentials"  # Default flow in current implementation
        _posthog_telemetry.track_bot_started(
            handler_count=len(self._handlers),
            invoke_handler_count=len(self._invoke_handlers),
            middleware_count=len(self._middlewares),
            has_catch_all=self.on_activity is not None,
            has_state_storage=self._has_state_storage,
            auth_flow=auth_flow,
        )

        # PostHog: botas/activity_received (once per turn)
        has_handler = (
            (activity.type == "invoke" and bool(self._invoke_handlers))
            or self.on_activity is not None
            or activity.type.lower() in self._handlers
        )
        _posthog_telemetry.track_activity_received(
            activity_type=activity.type or "",
            has_handler=has_handler,
            channel_id=activity.channel_id,
        )

        metrics = get_metrics()
        if metrics:
            metrics.activities_received.add(1, {"activity.type": activity.type or ""})
        start_time = time.perf_counter()

        with _span(
            "botas.turn",
            **{
                "activity.type": activity.type or "",
                "activity.id": activity.id or "",
                "conversation.id": activity.conversation.id if activity.conversation else "",
                "channel.id": activity.channel_id or "",
                "bot.id": self._token_manager.client_id or "",
            },
        ):
            try:
                return await self._run_pipeline(activity)
            finally:
                if metrics:
                    elapsed_ms = (time.perf_counter() - start_time) * 1000
                    metrics.turn_duration.record(elapsed_ms, {"activity.type": activity.type or ""})

    async def send_activity_async(
        self,
        service_url: str,
        conversation_id: str,
        activity: Union[
            CoreActivity,
            dict[str, Any],
        ],
    ) -> Optional[ResourceResponse]:
        """Proactively send an activity to a conversation.

        Use this to push messages outside of the normal turn pipeline (e.g.
        notifications or proactive messages).

        Args:
            service_url: The channel's service URL.
            conversation_id: Target conversation identifier.
            activity: The activity payload to send.

        Returns:
            A :class:`ResourceResponse` with the new activity ID, or ``None``
            if the channel does not return one.
        """
        return await self.conversation_client.send_activity_async(service_url, conversation_id, activity)

    async def aclose(self) -> None:
        """Close the underlying HTTP client and release resources.

        Should be called during application shutdown.  Alternatively, use the
        bot as an async context manager to ensure automatic cleanup.
        """
        await self.conversation_client.aclose()

    async def __aenter__(self) -> "BotApplication":
        """Enter the async context manager."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit the async context manager, ensuring resources are closed."""
        await self.aclose()

    async def _handle_activity_async(self, context: TurnContext) -> Optional[InvokeResponse]:
        from botas import _posthog_telemetry

        if context.activity.type == "invoke":
            return await self._dispatch_invoke_async(context)
        handler = self.on_activity or self._handlers.get(context.activity.type.lower())
        if handler is None:
            return None
        dispatch_mode = "catchall" if self.on_activity else "type"
        handler_start = time.perf_counter()
        with _span(
            "botas.handler",
            **{"handler.type": context.activity.type, "handler.dispatch": dispatch_mode},
        ):
            try:
                await handler(context)
                # PostHog: botas/handler_dispatched (on success)
                elapsed_ms = int((time.perf_counter() - handler_start) * 1000)
                _posthog_telemetry.track_handler_dispatched(
                    activity_type=context.activity.type,
                    dispatch_mode=dispatch_mode,
                    duration_ms=elapsed_ms,
                )
            except Exception as exc:
                # PostHog: botas/handler_error (on error)
                error_type = type(exc).__name__
                _posthog_telemetry.track_handler_error(
                    activity_type=context.activity.type,
                    error_type=error_type,
                )
                metrics = get_metrics()
                if metrics:
                    metrics.handler_errors.add(1, {"activity.type": context.activity.type})
                raise BotHandlerException(
                    f'Handler for "{context.activity.type}" threw an error',
                    exc,
                    context.activity,
                ) from exc
        return None

    async def _dispatch_invoke_async(self, context: TurnContext) -> InvokeResponse:
        from botas import _posthog_telemetry

        if not self._invoke_handlers:
            return InvokeResponse(status=200, body={})
        name = context.activity.name
        handler = self._invoke_handlers.get(name.lower()) if name else None
        if handler is None:
            return InvokeResponse(status=501)
        handler_start = time.perf_counter()
        with _span(
            "botas.handler",
            **{"handler.type": "invoke", "handler.dispatch": "invoke"},
        ):
            try:
                result = await handler(context)
                # PostHog: botas/handler_dispatched (on success)
                elapsed_ms = int((time.perf_counter() - handler_start) * 1000)
                _posthog_telemetry.track_handler_dispatched(
                    activity_type="invoke",
                    dispatch_mode="invoke",
                    duration_ms=elapsed_ms,
                )
                return result
            except Exception as exc:
                # PostHog: botas/handler_error (on error)
                error_type = type(exc).__name__
                _posthog_telemetry.track_handler_error(
                    activity_type="invoke",
                    error_type=error_type,
                )
                metrics = get_metrics()
                if metrics:
                    metrics.handler_errors.add(1, {"activity.type": "invoke"})
                raise BotHandlerException(
                    f'Invoke handler for "{name}" threw an error',
                    exc,
                    context.activity,
                ) from exc

    async def _run_pipeline(self, activity: CoreActivity) -> Optional[InvokeResponse]:
        context = TurnContext(self, activity)
        index = 0
        invoke_response: Optional[InvokeResponse] = None

        async def next_fn() -> None:
            nonlocal index, invoke_response
            if index < len(self._middlewares):
                mw = self._middlewares[index]
                mw_index = index
                index += 1
                mw_name = type(mw).__name__
                mw_start = time.perf_counter()
                with _span(
                    "botas.middleware",
                    **{"middleware.name": mw_name, "middleware.index": mw_index},
                ):
                    try:
                        await mw.on_turn(context, next_fn)
                    finally:
                        metrics = get_metrics()
                        if metrics:
                            elapsed_ms = (time.perf_counter() - mw_start) * 1000
                            metrics.middleware_duration.record(elapsed_ms, {"middleware.name": mw_name})
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
