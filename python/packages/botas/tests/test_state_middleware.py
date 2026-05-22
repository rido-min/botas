"""Tests for state middleware integration with BotApplication."""

from __future__ import annotations

import asyncio

import pytest

from botas import BotApplication, TurnContext
from botas.state import MemoryStorage


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


class TestStateMiddleware:
    """Tests for use_state middleware integration."""

    @pytest.mark.asyncio
    async def test_state_attached_to_context(self):
        bot = BotApplication()
        storage = MemoryStorage()
        bot.use_state(storage)

        received_contexts: list[TurnContext] = []

        @bot.on("message")
        async def handler(ctx: TurnContext):
            received_contexts.append(ctx)

        await bot.process_body(_make_body())
        assert len(received_contexts) == 1
        ctx = received_contexts[0]
        assert ctx.state is not None

    @pytest.mark.asyncio
    async def test_state_persists_across_turns(self):
        bot = BotApplication()
        storage = MemoryStorage()
        bot.use_state(storage)

        @bot.on("message")
        async def handler(ctx: TurnContext):
            if ctx.state:
                count = ctx.state.conversation.get("count", int) or 0
                count += 1
                ctx.state.conversation.set("count", count)

        # First turn
        await bot.process_body(_make_body())
        # Second turn
        await bot.process_body(_make_body())

        # Verify state was persisted
        keys = ["msteams/bot1/conversations/conv1"]
        data = await storage.read(keys)
        assert data[keys[0]]["count"] == 2  # type: ignore

    @pytest.mark.asyncio
    async def test_state_not_saved_on_handler_exception(self):
        bot = BotApplication()
        storage = MemoryStorage()
        bot.use_state(storage)

        @bot.on("message")
        async def handler(ctx: TurnContext):
            if ctx.state:
                ctx.state.conversation.set("count", 999)
            raise RuntimeError("Handler error")

        with pytest.raises(Exception):
            await bot.process_body(_make_body())

        # Verify state was NOT persisted
        keys = ["msteams/bot1/conversations/conv1"]
        data = await storage.read(keys)
        assert keys[0] not in data

    @pytest.mark.asyncio
    async def test_dirty_tracking_no_writes_when_unchanged(self):
        bot = BotApplication()
        storage = MemoryStorage()
        bot.use_state(storage)

        # Pre-populate storage
        conv_key = "msteams/bot1/conversations/conv1"
        await storage.write({conv_key: {"count": 5}})

        @bot.on("message")
        async def handler(ctx: TurnContext):
            # Read but don't modify
            if ctx.state:
                _ = ctx.state.conversation.get("count", int)

        await bot.process_body(_make_body())

        # Verify no additional writes (count still 5)
        data = await storage.read([conv_key])
        assert data[conv_key]["count"] == 5  # type: ignore

    @pytest.mark.asyncio
    async def test_user_scope_persistence(self):
        bot = BotApplication()
        storage = MemoryStorage()
        bot.use_state(storage)

        @bot.on("message")
        async def handler(ctx: TurnContext):
            if ctx.state:
                name = ctx.state.user.get("name", str)
                if not name:
                    ctx.state.user.set("name", "Alice")

        # First turn
        await bot.process_body(_make_body())

        # Verify user state was persisted
        user_key = "msteams/bot1/users/user1"
        data = await storage.read([user_key])
        assert data[user_key]["name"] == "Alice"  # type: ignore

    @pytest.mark.asyncio
    async def test_temp_scope_not_persisted(self):
        bot = BotApplication()
        storage = MemoryStorage()
        bot.use_state(storage)

        @bot.on("message")
        async def handler(ctx: TurnContext):
            if ctx.state:
                ctx.state.temp.set("input", "hello")

        await bot.process_body(_make_body())

        # Verify temp state was NOT persisted (no keys written)
        all_keys = list(storage._store.keys())
        assert len(all_keys) == 0

    @pytest.mark.asyncio
    async def test_delete_conversation_state(self):
        bot = BotApplication()
        storage = MemoryStorage()
        bot.use_state(storage)

        # Pre-populate storage
        conv_key = "msteams/bot1/conversations/conv1"
        await storage.write({conv_key: {"count": 5}})

        @bot.on("message")
        async def handler(ctx: TurnContext):
            if ctx.state:
                ctx.state.delete_conversation_state()

        await bot.process_body(_make_body())

        # Verify state was deleted
        data = await storage.read([conv_key])
        assert conv_key not in data

    @pytest.mark.asyncio
    async def test_concurrent_turns_for_same_user_preserve_both_updates(self):
        bot = BotApplication()
        storage = MemoryStorage()
        bot.use_state(storage)

        @bot.on("message")
        async def handler(ctx: TurnContext):
            if ctx.state:
                count = ctx.state.user.get("count", int) or 0
                await asyncio.sleep(0.01)
                ctx.state.user.set("count", count + 1)

        await asyncio.gather(
            bot.process_body(_make_body(id="act1")),
            bot.process_body(_make_body(id="act2")),
        )

        user_key = "msteams/bot1/users/user1"
        data = await storage.read([user_key])
        assert data[user_key]["count"] == 2  # type: ignore
