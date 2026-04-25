from unittest.mock import AsyncMock, patch

import pytest

from botas.bot_application import BotApplication, BotHandlerException
from botas.turn_context import TurnContext


def _make_body(**overrides) -> str:
    import json

    data = {
        "type": "message",
        "id": "act1",
        "channelId": "msteams",
        "serviceUrl": "http://localhost:3978/",
        "from": {"id": "user1"},
        "recipient": {"id": "bot1"},
        "conversation": {"id": "conv1"},
        "text": "hello",
    }
    data.update(overrides)
    return json.dumps(data)


class TestProcessBody:
    async def test_dispatches_to_registered_handler(self):
        bot = BotApplication()
        received: list[TurnContext] = []

        async def handler(ctx: TurnContext):
            received.append(ctx)

        bot.on("message", handler)
        await bot.process_body(_make_body())
        assert len(received) == 1
        assert received[0].activity.type == "message"
        assert received[0].activity.text == "hello"

    async def test_silently_ignores_unregistered_type(self):
        bot = BotApplication()
        called = False

        async def handler(ctx: TurnContext):
            nonlocal called
            called = True

        bot.on("message", handler)
        await bot.process_body(_make_body(type="conversationUpdate"))
        assert not called

    async def test_dispatches_conversation_update(self):
        bot = BotApplication()
        received: list[TurnContext] = []

        async def handler(ctx: TurnContext):
            received.append(ctx)

        bot.on("conversationUpdate", handler)
        await bot.process_body(_make_body(type="conversationUpdate"))
        assert len(received) == 1
        assert received[0].activity.type == "conversationUpdate"

    async def test_replaces_handler_on_duplicate_registration(self):
        bot = BotApplication()
        calls: list[str] = []

        async def first(ctx: TurnContext):
            calls.append("first")

        async def second(ctx: TurnContext):
            calls.append("second")

        bot.on("message", first)
        bot.on("message", second)
        await bot.process_body(_make_body())
        assert calls == ["second"]

    async def test_exposes_appid_property(self):
        from botas.token_manager import BotApplicationOptions

        options = BotApplicationOptions(client_id="bot-app-id")
        bot = BotApplication(options)

        assert bot.appid == "bot-app-id"

    async def test_raises_value_error_on_malformed_json(self):
        bot = BotApplication()
        with pytest.raises(ValueError, match="Invalid JSON in request body"):
            await bot.process_body("not valid json {{{")

    async def test_raises_on_missing_type(self):
        import json

        bot = BotApplication()
        body = json.dumps({"serviceUrl": "http://localhost:3978/", "conversation": {"id": "c"}})
        with pytest.raises(Exception, match="type"):
            await bot.process_body(body)

    async def test_raises_on_missing_service_url(self):
        import json

        bot = BotApplication()
        body = json.dumps({"type": "message", "conversation": {"id": "c"}})
        with pytest.raises(Exception, match="serviceUrl"):
            await bot.process_body(body)

    async def test_raises_on_missing_conversation_id(self):
        import json

        bot = BotApplication()
        body = json.dumps({"type": "message", "serviceUrl": "http://localhost:3978/", "conversation": {}})
        with pytest.raises(Exception, match="conversation"):
            await bot.process_body(body)


class TestTurnContext:
    async def test_provides_app_reference(self):
        bot = BotApplication()
        ctx_ref: list[TurnContext] = []

        async def handler(ctx: TurnContext):
            ctx_ref.append(ctx)

        bot.on("message", handler)
        await bot.process_body(_make_body())
        assert len(ctx_ref) == 1
        assert ctx_ref[0].app is bot

    async def test_provides_send_function(self):
        bot = BotApplication()
        has_send = False

        async def handler(ctx: TurnContext):
            nonlocal has_send
            has_send = callable(ctx.send)

        bot.on("message", handler)
        await bot.process_body(_make_body())
        assert has_send


class TestBotHandlerException:
    async def test_wraps_handler_error_with_activity(self):
        bot = BotApplication()
        cause = ValueError("handler blew up")

        async def bad_handler(ctx: TurnContext):
            raise cause

        bot.on("message", bad_handler)
        with pytest.raises(BotHandlerException) as exc_info:
            await bot.process_body(_make_body())

        err = exc_info.value
        assert err.cause is cause
        assert err.activity.type == "message"
        assert err.name == "BotHandlerException"

    async def test_exception_message_includes_activity_type(self):
        bot = BotApplication()

        async def bad_handler(ctx: TurnContext):
            raise RuntimeError("oops")

        bot.on("message", bad_handler)
        with pytest.raises(BotHandlerException) as exc_info:
            await bot.process_body(_make_body())

        assert "message" in str(exc_info.value)


class TestMiddleware:
    async def test_runs_middleware_before_handler(self):
        bot = BotApplication()
        order: list[str] = []

        class Mw:
            async def on_turn(self, context, next):
                order.append("middleware")
                await next()

        async def handler(ctx: TurnContext):
            order.append("handler")

        bot.use(Mw())
        bot.on("message", handler)
        await bot.process_body(_make_body())
        assert order == ["middleware", "handler"]

    async def test_runs_multiple_middleware_in_order(self):
        bot = BotApplication()
        order: list[str] = []

        class Mw:
            def __init__(self, name: str):
                self.name = name

            async def on_turn(self, context, next):
                order.append(self.name)
                await next()

        async def handler(ctx: TurnContext):
            order.append("handler")

        bot.use(Mw("mw1"))
        bot.use(Mw("mw2"))
        bot.on("message", handler)
        await bot.process_body(_make_body())
        assert order == ["mw1", "mw2", "handler"]

    async def test_middleware_can_short_circuit(self):
        bot = BotApplication()
        handler_called = False

        class ShortCircuit:
            async def on_turn(self, context, next):
                pass  # no next()

        async def handler(ctx: TurnContext):
            nonlocal handler_called
            handler_called = True

        bot.use(ShortCircuit())
        bot.on("message", handler)
        await bot.process_body(_make_body())
        assert not handler_called

    async def test_middleware_receives_turn_context(self):
        bot = BotApplication()
        ctx_ref: list[TurnContext] = []

        class Mw:
            async def on_turn(self, context, next):
                ctx_ref.append(context)
                await next()

        async def handler(ctx: TurnContext):
            pass

        bot.use(Mw())
        bot.on("message", handler)
        await bot.process_body(_make_body())
        assert len(ctx_ref) == 1
        assert ctx_ref[0].activity.type == "message"
        assert ctx_ref[0].app is bot


class TestOnDecorator:
    async def test_on_as_decorator(self):
        bot = BotApplication()
        received: list[TurnContext] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx)

        await bot.process_body(_make_body())
        assert len(received) == 1


class TestOnActivityCatchAll:
    async def test_receives_all_activity_types(self):
        bot = BotApplication()
        received: list[str] = []

        async def catch_all(ctx: TurnContext):
            received.append(ctx.activity.type)

        bot.on_activity = catch_all
        await bot.process_body(_make_body(type="message"))
        await bot.process_body(_make_body(type="conversationUpdate"))
        assert received == ["message", "conversationUpdate"]

    async def test_bypasses_per_type_handlers(self):
        bot = BotApplication()
        per_type_called = False

        async def per_type(ctx: TurnContext):
            nonlocal per_type_called
            per_type_called = True

        async def catch_all(ctx: TurnContext):
            pass

        bot.on("message", per_type)
        bot.on_activity = catch_all
        await bot.process_body(_make_body())
        assert not per_type_called

    async def test_wraps_errors_in_bot_handler_exception(self):
        bot = BotApplication()
        cause = RuntimeError("catch-all boom")

        async def catch_all(ctx: TurnContext):
            raise cause

        bot.on_activity = catch_all
        with pytest.raises(BotHandlerException) as exc_info:
            await bot.process_body(_make_body())

        err = exc_info.value
        assert err.cause is cause
        assert err.activity.type == "message"

    async def test_per_type_dispatch_when_on_activity_not_set(self):
        bot = BotApplication()
        received: list[TurnContext] = []

        async def handler(ctx: TurnContext):
            received.append(ctx)

        bot.on("message", handler)
        assert bot.on_activity is None
        await bot.process_body(_make_body())
        assert len(received) == 1


class TestResourceCleanup:
    async def test_aclose_closes_http_client(self):
        """Verify that aclose() properly closes the underlying HTTP client."""
        bot = BotApplication()
        # Call aclose and ensure no exception is raised
        await bot.aclose()
        # Calling aclose again should also be safe
        await bot.aclose()

    async def test_async_context_manager(self):
        """Verify that BotApplication can be used as an async context manager."""
        async with BotApplication() as bot:
            received: list[TurnContext] = []

            async def handler(ctx: TurnContext):
                received.append(ctx)

            bot.on("message", handler)
            await bot.process_body(_make_body())
            assert len(received) == 1
        # Context manager should have closed resources on exit

    async def test_async_context_manager_handles_exceptions(self):
        """Verify that context manager closes resources even when exception occurs."""
        with pytest.raises(RuntimeError):
            async with BotApplication():
                raise RuntimeError("test error")
        # Context manager should have closed resources despite exception

    async def test_aclose_delegates_to_conversation_client(self):
        """Verify that aclose() calls through to conversation_client.aclose()."""
        bot = BotApplication()
        with patch.object(bot.conversation_client, "aclose", new_callable=AsyncMock) as mock_aclose:
            await bot.aclose()
            mock_aclose.assert_awaited_once()

    async def test_context_manager_delegates_aclose(self):
        """Verify that __aexit__ calls aclose which delegates to conversation_client."""
        bot = BotApplication()
        with patch.object(bot.conversation_client, "aclose", new_callable=AsyncMock) as mock_aclose:
            async with bot:
                mock_aclose.assert_not_called()
            mock_aclose.assert_awaited_once()


class TestOnInvoke:
    async def test_dispatches_invoke_to_handler_by_name(self):
        from botas.bot_application import InvokeResponse

        bot = BotApplication()
        received: list[TurnContext] = []

        async def handler(ctx: TurnContext) -> InvokeResponse:
            received.append(ctx)
            return InvokeResponse(status=200, body={"ok": True})

        bot.on_invoke("adaptiveCard/action", handler)
        result = await bot.process_body(_make_body(type="invoke", name="adaptiveCard/action"))
        assert len(received) == 1
        assert received[0].activity.type == "invoke"
        assert result is not None
        assert result.status == 200
        assert result.body == {"ok": True}

    async def test_returns_200_when_no_invoke_handlers_registered(self):
        bot = BotApplication()
        result = await bot.process_body(_make_body(type="invoke", name="task/fetch"))
        assert result is not None
        assert result.status == 200
        assert result.body == {}

    async def test_returns_200_when_no_invoke_handlers_and_no_name(self):
        bot = BotApplication()
        result = await bot.process_body(_make_body(type="invoke"))
        assert result is not None
        assert result.status == 200
        assert result.body == {}

    async def test_returns_501_when_handlers_exist_but_none_match(self):
        from botas.bot_application import InvokeResponse

        bot = BotApplication()

        async def handler(ctx: TurnContext) -> InvokeResponse:
            return InvokeResponse(status=200, body={"ok": True})

        bot.on_invoke("adaptiveCard/action", handler)
        result = await bot.process_body(_make_body(type="invoke", name="task/fetch"))
        assert result is not None
        assert result.status == 501

    async def test_returns_501_when_handlers_exist_but_invoke_has_no_name(self):
        from botas.bot_application import InvokeResponse

        bot = BotApplication()

        async def handler(ctx: TurnContext) -> InvokeResponse:
            return InvokeResponse(status=200, body={"ok": True})

        bot.on_invoke("adaptiveCard/action", handler)
        result = await bot.process_body(_make_body(type="invoke"))
        assert result is not None
        assert result.status == 501

    async def test_replaces_handler_on_duplicate_name(self):
        from botas.bot_application import InvokeResponse

        bot = BotApplication()
        calls: list[str] = []

        async def first(ctx: TurnContext) -> InvokeResponse:
            calls.append("first")
            return InvokeResponse(status=200)

        async def second(ctx: TurnContext) -> InvokeResponse:
            calls.append("second")
            return InvokeResponse(status=200)

        bot.on_invoke("task/fetch", first)
        bot.on_invoke("task/fetch", second)
        await bot.process_body(_make_body(type="invoke", name="task/fetch"))
        assert calls == ["second"]

    async def test_wraps_invoke_handler_error_in_bot_handler_exception(self):
        from botas.bot_application import InvokeResponse

        bot = BotApplication()
        cause = ValueError("invoke boom")

        async def bad_handler(ctx: TurnContext) -> InvokeResponse:
            raise cause

        bot.on_invoke("task/submit", bad_handler)
        with pytest.raises(BotHandlerException) as exc_info:
            await bot.process_body(_make_body(type="invoke", name="task/submit"))

        err = exc_info.value
        assert err.cause is cause
        assert err.activity.type == "invoke"

    async def test_returns_none_for_non_invoke_activities(self):
        bot = BotApplication()
        bot.on("message", lambda ctx: None)  # type: ignore[arg-type]

        async def handler(ctx: TurnContext) -> None:
            pass

        bot.on("message", handler)
        result = await bot.process_body(_make_body(type="message"))
        assert result is None

    async def test_on_invoke_as_decorator(self):
        from botas.bot_application import InvokeResponse

        bot = BotApplication()
        received: list[TurnContext] = []

        @bot.on_invoke("adaptiveCard/action")
        async def handler(ctx: TurnContext) -> InvokeResponse:
            received.append(ctx)
            return InvokeResponse(status=200)

        await bot.process_body(_make_body(type="invoke", name="adaptiveCard/action"))
        assert len(received) == 1
