import json

from botas.turn_context import TurnContext
from httpx import ASGITransport, AsyncClient

from botas_fastapi.bot_app import BotApp

_TEST_ACTIVITY = json.dumps({
    "type": "message",
    "serviceUrl": "http://service.url",
    "from": {"id": "user1"},
    "recipient": {"id": "bot1"},
    "conversation": {"id": "conv1"},
    "text": "hello",
})

_JSON_HEADERS = {"Content-Type": "application/json"}


class TestBotApp:
    async def test_post_messages_dispatches_to_handler(self):
        app = BotApp(auth=False)
        received: list[TurnContext] = []

        @app.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx)

        fastapi_app = app._build_app()
        async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as client:
            resp = await client.post("/api/messages", content=_TEST_ACTIVITY, headers=_JSON_HEADERS)

        assert resp.status_code == 200
        assert resp.json() == {}
        assert len(received) == 1
        assert received[0].activity.text == "hello"

    async def test_health_endpoint(self):
        app = BotApp(auth=False)
        fastapi_app = app._build_app()
        async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as client:
            resp = await client.get("/health")

        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    async def test_root_endpoint(self):
        app = BotApp(auth=False)
        fastapi_app = app._build_app()
        async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as client:
            resp = await client.get("/")

        assert resp.status_code == 200
        assert "Running" in resp.json()["message"]

    async def test_custom_path(self):
        app = BotApp(auth=False, path="/bot")
        called = False

        @app.on("message")
        async def handler(ctx: TurnContext):
            nonlocal called
            called = True

        fastapi_app = app._build_app()
        async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as client:
            resp = await client.post("/bot", content=_TEST_ACTIVITY, headers=_JSON_HEADERS)

        assert resp.status_code == 200
        assert called

    async def test_middleware_delegation(self):
        app = BotApp(auth=False)
        order: list[str] = []

        class Mw:
            async def on_turn(self, context, next):
                order.append("mw")
                await next()

        app.use(Mw())

        @app.on("message")
        async def handler(ctx: TurnContext):
            order.append("handler")

        fastapi_app = app._build_app()
        async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as client:
            await client.post("/api/messages", content=_TEST_ACTIVITY, headers=_JSON_HEADERS)

        assert order == ["mw", "handler"]

    async def test_on_as_two_arg_call(self):
        app = BotApp(auth=False)
        received: list[TurnContext] = []

        async def handler(ctx: TurnContext):
            received.append(ctx)

        app.on("message", handler)

        fastapi_app = app._build_app()
        async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as client:
            await client.post("/api/messages", content=_TEST_ACTIVITY, headers=_JSON_HEADERS)

        assert len(received) == 1
