import json
from unittest.mock import AsyncMock

from botas.bot_application import BotApplication
from botas.core_activity import ResourceResponse
from botas.turn_context import TurnContext


def _make_body(**overrides) -> str:
    data = {
        "type": "message",
        "id": "act1",
        "channelId": "msteams",
        "serviceUrl": "http://service.url",
        "from": {"id": "user1", "name": "User One"},
        "recipient": {"id": "bot1", "name": "Bot"},
        "conversation": {"id": "conv1"},
        "text": "hello",
    }
    data.update(overrides)
    return json.dumps(data)


class TestSendTyping:
    async def test_sends_typing_activity_with_routing_fields(self):
        bot = BotApplication()
        sent: list[tuple[str, str, dict]] = []

        async def mock_send(service_url: str, conversation_id: str, activity):
            sent.append((service_url, conversation_id, activity))
            return ResourceResponse(id="typing1")

        bot.send_activity_async = AsyncMock(side_effect=mock_send)

        @bot.on("message")
        async def handler(ctx: TurnContext):
            await ctx.send_typing()

        await bot.process_body(_make_body())

        assert len(sent) == 1
        service_url, conv_id, activity = sent[0]
        assert service_url == "http://service.url"
        assert conv_id == "conv1"
        assert activity.type == "typing"

    async def test_typing_activity_has_correct_routing(self):
        bot = BotApplication()
        sent_activity = None

        async def capture_send(service_url: str, conversation_id: str, activity):
            nonlocal sent_activity
            sent_activity = activity
            return ResourceResponse(id="typing1")

        bot.send_activity_async = AsyncMock(side_effect=capture_send)

        @bot.on("message")
        async def handler(ctx: TurnContext):
            await ctx.send_typing()

        await bot.process_body(_make_body())

        assert sent_activity is not None
        assert sent_activity.type == "typing"
        # Routing fields should be swapped (from incoming)
        assert sent_activity.from_account.id == "bot1"  # was recipient
        assert sent_activity.recipient.id == "user1"  # was from
        assert sent_activity.conversation.id == "conv1"
        assert sent_activity.service_url == "http://service.url"

    async def test_typing_activity_has_no_text(self):
        bot = BotApplication()
        sent_activity = None

        async def capture_send(service_url: str, conversation_id: str, activity):
            nonlocal sent_activity
            sent_activity = activity
            return None

        bot.send_activity_async = AsyncMock(side_effect=capture_send)

        @bot.on("message")
        async def handler(ctx: TurnContext):
            await ctx.send_typing()

        await bot.process_body(_make_body(text="hello there"))

        assert sent_activity is not None
        assert sent_activity.type == "typing"
        # Text should not be set (or should be empty/None)
        assert sent_activity.text in (None, "")

    async def test_send_typing_returns_none(self):
        bot = BotApplication()
        result_holder: list = []

        bot.send_activity_async = AsyncMock(return_value=ResourceResponse(id="typing1"))

        @bot.on("message")
        async def handler(ctx: TurnContext):
            result = await ctx.send_typing()
            result_holder.append(result)

        await bot.process_body(_make_body())

        assert len(result_holder) == 1
        assert result_holder[0] is None
