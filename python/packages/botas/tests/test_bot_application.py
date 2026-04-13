import pytest

from botas.bot_application import BotApplication, BotHandlerException
from botas.turn_context import TurnContext


def _make_body(**overrides) -> str:
    import json
    data = {
        "type": "message",
        "id": "act1",
        "channelId": "msteams",
        "serviceUrl": "http://service.url",
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

    async def test_raises_on_missing_type(self):
        import json
        bot = BotApplication()
        body = json.dumps({"serviceUrl": "http://s", "conversation": {"id": "c"}})
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
        body = json.dumps({"type": "message", "serviceUrl": "http://s", "conversation": {}})
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
            async def on_turn_async(self, context, next):
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

            async def on_turn_async(self, context, next):
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
            async def on_turn_async(self, context, next):
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
            async def on_turn_async(self, context, next):
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
