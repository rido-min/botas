"""Cross-language behavioral parity tests for TurnState.

These tests mirror identical scenarios in .NET and Node.js to ensure behavioral consistency.
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from botas import BotApplication, TurnContext
from botas.state import MemoryStorage, Storage


def _make_body(**overrides) -> str:
    """Create a test activity body."""
    data = {
        "type": "message",
        "id": "act1",
        "channelId": "msteams",
        "serviceUrl": "http://localhost:3978/",
        "from": {"id": "user-456", "name": "Test User"},
        "recipient": {"id": "bot-123", "name": "Test Bot"},
        "conversation": {"id": "conv-789"},
        "text": "hello",
    }
    data.update(overrides)
    return json.dumps(data)


class TestStateBehavioralParity:
    """Cross-language behavioral parity tests for TurnState."""

    @pytest.mark.asyncio
    async def test_atomic_on_error_state_not_persisted_when_handler_throws(self):
        """Scenario 1: Atomic on error — state changes are NOT persisted when handler throws."""
        bot = BotApplication()
        storage = MemoryStorage()
        bot.use_state(storage)

        @bot.on("message")
        async def handler(ctx: TurnContext):
            # Mutate state
            if ctx.state:
                ctx.state.conversation.set("count", 999)
                ctx.state.user.set("name", "should-not-persist")

            # Then throw
            raise RuntimeError("Handler error")

        with pytest.raises(Exception):
            await bot.process_body(_make_body())

        # Verify NO state was persisted
        conv_key = "msteams/bot-123/conversations/conv-789"
        user_key = "msteams/bot-123/users/user-456"
        result = await storage.read([conv_key, user_key])

        assert result == {}

    @pytest.mark.asyncio
    async def test_successful_turn_state_is_persisted_and_visible_on_next_turn(self):
        """Scenario 2: Successful turn persists — state changes are visible on next turn."""
        bot = BotApplication()
        storage = MemoryStorage()
        bot.use_state(storage)

        # First turn: write state
        @bot.on("message")
        async def handler(ctx: TurnContext):
            if ctx.state:
                ctx.state.conversation.set("count", 42)
                ctx.state.user.set("name", "Alice")

        await bot.process_body(_make_body())

        # Verify state was persisted
        conv_key = "msteams/bot-123/conversations/conv-789"
        user_key = "msteams/bot-123/users/user-456"
        result = await storage.read([conv_key, user_key])

        assert conv_key in result
        assert user_key in result
        assert result[conv_key]["count"] == 42  # type: ignore
        assert result[user_key]["name"] == "Alice"  # type: ignore

        # Second turn: read state (fresh TurnState instance)
        read_count = 0
        read_name = ""

        @bot.on("message")
        async def handler_second(ctx: TurnContext):
            nonlocal read_count, read_name
            if ctx.state:
                read_count = ctx.state.conversation.get("count", int) or 0
                read_name = ctx.state.user.get("name", str) or ""

        await bot.process_body(_make_body())

        assert read_count == 42
        assert read_name == "Alice"

    @pytest.mark.asyncio
    async def test_dirty_tracking_no_write_when_state_only_read(self):
        """Scenario 3: Dirty tracking — reading without mutation does NOT trigger write."""
        bot = BotApplication()

        write_call_count = 0

        class TrackingStorage(Storage):
            """Storage that tracks write calls."""

            _data: dict[str, Any]

            def __init__(self):
                self._data = {}

            async def read(self, keys: list[str]) -> dict[str, Any]:
                conv_key = "msteams/bot-123/conversations/conv-789"
                if conv_key in keys:
                    return {conv_key: {"count": 5}}
                return {}

            async def write(self, changes: dict[str, Any]) -> None:
                nonlocal write_call_count
                write_call_count += 1
                self._data.update(changes)

            async def delete(self, keys: list[str]) -> None:
                for key in keys:
                    self._data.pop(key, None)

        storage = TrackingStorage()
        bot.use_state(storage)

        @bot.on("message")
        async def handler(ctx: TurnContext):
            # Read but don't mutate
            if ctx.state:
                count = ctx.state.conversation.get("count", int)
                assert count == 5

        await bot.process_body(_make_body())

        # Verify write was NOT called (dirty tracking prevented unnecessary persistence)
        assert write_call_count == 0

    @pytest.mark.asyncio
    async def test_scope_isolation_conversation_write_does_not_affect_user_scope(self):
        """Scenario 4: Scope isolation — writing to one scope does NOT affect others."""
        bot = BotApplication()
        storage = MemoryStorage()
        bot.use_state(storage)

        # First turn: write ONLY to conversation scope
        @bot.on("message")
        async def handler(ctx: TurnContext):
            if ctx.state:
                ctx.state.conversation.set("data", "conversation-data")
                # Do NOT write to user scope

        await bot.process_body(_make_body())

        # Verify conversation scope was persisted
        conv_key = "msteams/bot-123/conversations/conv-789"
        user_key = "msteams/bot-123/users/user-456"
        result = await storage.read([conv_key, user_key])

        assert conv_key in result
        assert user_key not in result  # User key should NOT exist

        # Second turn: verify user scope reads return None
        user_data = "unset"

        @bot.on("message")
        async def handler_second(ctx: TurnContext):
            nonlocal user_data
            if ctx.state:
                user_data = ctx.state.user.get("data", str)  # type: ignore

        await bot.process_body(_make_body())

        assert user_data is None
