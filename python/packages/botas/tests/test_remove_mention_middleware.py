import json

from botas.bot_application import BotApplication
from botas.remove_mention_middleware import RemoveMentionMiddleware
from botas.token_manager import BotApplicationOptions
from botas.turn_context import TurnContext


def _make_body(**overrides) -> str:
    data = {
        "type": "message",
        "id": "act1",
        "channelId": "msteams",
        "serviceUrl": "http://service.url",
        "from": {"id": "user1"},
        "recipient": {"id": "bot1", "name": "TestBot"},
        "conversation": {"id": "conv1"},
        "text": "<at>TestBot</at> hello world",
        "entities": [
            {
                "type": "mention",
                "mentioned": {"id": "bot1", "name": "TestBot"},
                "text": "<at>TestBot</at>",
            }
        ],
    }
    data.update(overrides)
    return json.dumps(data)


class TestRemoveMentionMiddleware:
    async def test_strips_bot_mention_from_text(self):
        bot = BotApplication()
        bot.use(RemoveMentionMiddleware())

        received: list[str] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx.activity.text or "")

        await bot.process_body(_make_body())
        assert received == ["hello world"]

    async def test_leaves_text_when_no_entities(self):
        bot = BotApplication()
        bot.use(RemoveMentionMiddleware())

        received: list[str] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx.activity.text or "")

        await bot.process_body(
            _make_body(
                text="plain message",
                entities=None,
            )
        )
        assert received == ["plain message"]

    async def test_ignores_non_mention_entities(self):
        bot = BotApplication()
        bot.use(RemoveMentionMiddleware())

        received: list[str] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx.activity.text or "")

        await bot.process_body(
            _make_body(
                text="hello",
                entities=[{"type": "clientInfo"}],
            )
        )
        assert received == ["hello"]

    async def test_does_not_strip_mention_of_other_user(self):
        bot = BotApplication()
        bot.use(RemoveMentionMiddleware())

        received: list[str] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx.activity.text or "")

        await bot.process_body(
            _make_body(
                text="<at>Alice</at> check this",
                entities=[
                    {
                        "type": "mention",
                        "mentioned": {"id": "alice1", "name": "Alice"},
                        "text": "<at>Alice</at>",
                    }
                ],
            )
        )
        assert received == ["<at>Alice</at> check this"]

    async def test_strips_mention_matching_appid(self):
        options = BotApplicationOptions(client_id="my-app-id")
        bot = BotApplication(options)
        bot.use(RemoveMentionMiddleware())

        received: list[str] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx.activity.text or "")

        await bot.process_body(
            _make_body(
                text="<at>MyBot</at> ping",
                entities=[
                    {
                        "type": "mention",
                        "mentioned": {"id": "my-app-id", "name": "MyBot"},
                        "text": "<at>MyBot</at>",
                    }
                ],
            )
        )
        assert received == ["ping"]

    async def test_strips_multiple_bot_mentions(self):
        bot = BotApplication()
        bot.use(RemoveMentionMiddleware())

        received: list[str] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx.activity.text or "")

        await bot.process_body(
            _make_body(
                text="<at>TestBot</at> hello <at>TestBot</at>",
                entities=[
                    {
                        "type": "mention",
                        "mentioned": {"id": "bot1", "name": "TestBot"},
                        "text": "<at>TestBot</at>",
                    },
                    {
                        "type": "mention",
                        "mentioned": {"id": "bot1", "name": "TestBot"},
                        "text": "<at>TestBot</at>",
                    },
                ],
            )
        )
        assert received == ["hello"]

    async def test_middleware_calls_next(self):
        bot = BotApplication()
        order: list[str] = []

        class After:
            async def on_turn(self, context, next):
                order.append("after")
                await next()

        bot.use(RemoveMentionMiddleware())
        bot.use(After())

        @bot.on("message")
        async def handler(ctx: TurnContext):
            order.append("handler")

        await bot.process_body(_make_body())
        assert order == ["after", "handler"]

    async def test_case_insensitive_id_matching(self):
        bot = BotApplication()
        bot.use(RemoveMentionMiddleware())

        received: list[str] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx.activity.text or "")

        await bot.process_body(
            _make_body(
                text="<at>TestBot</at> hi",
                entities=[
                    {
                        "type": "mention",
                        "mentioned": {"id": "BOT1", "name": "TestBot"},
                        "text": "<at>TestBot</at>",
                    }
                ],
            )
        )
        assert received == ["hi"]

    async def test_case_insensitive_text_replacement(self):
        bot = BotApplication()
        bot.use(RemoveMentionMiddleware())

        received: list[str] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx.activity.text or "")

        await bot.process_body(
            _make_body(
                text="<AT>TestBot</AT> hey",
                entities=[
                    {
                        "type": "mention",
                        "mentioned": {"id": "bot1", "name": "TestBot"},
                        "text": "<at>TestBot</at>",
                    }
                ],
            )
        )
        assert received == ["hey"]

    async def test_does_not_match_by_recipient_name(self):
        bot = BotApplication()
        bot.use(RemoveMentionMiddleware())

        received: list[str] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx.activity.text or "")

        await bot.process_body(
            _make_body(
                text="<at>TestBot</at> hello",
                entities=[
                    {
                        "type": "mention",
                        "mentioned": {"id": "TestBot", "name": "TestBot"},
                        "text": "<at>TestBot</at>",
                    }
                ],
            )
        )
        # mentioned.id "TestBot" != recipient.id "bot1" — should NOT strip
        assert received == ["<at>TestBot</at> hello"]

    async def test_empty_text_after_stripping(self):
        bot = BotApplication()
        bot.use(RemoveMentionMiddleware())

        received: list[str] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received.append(ctx.activity.text or "")

        await bot.process_body(
            _make_body(
                text="<at>TestBot</at>",
                entities=[
                    {
                        "type": "mention",
                        "mentioned": {"id": "bot1", "name": "TestBot"},
                        "text": "<at>TestBot</at>",
                    }
                ],
            )
        )
        assert received == [""]
