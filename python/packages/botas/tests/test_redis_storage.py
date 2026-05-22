"""Tests for RedisStorage."""

from __future__ import annotations

import builtins
import json
import os
import re
import uuid
from unittest.mock import AsyncMock, patch

import fakeredis.aioredis
import pytest

from botas.state import RedisStorage
from botas.state.redis_storage import _INSTALL_HINT

ROUND_TRIP_STATE = {
    "key1": {"count": 5, "label": "hello"},
    "special/key:with%chars space🤖": {"emoji": "🤖", "text": "slash/colon:percent% space"},
    "empty-object": {},
    "nested-object": {"outer": {"inner": [1, "two", {"three": None}]}, "enabled": True},
    "null-inside-state": {"optional": None, "items": [None, {"value": "present"}]},
}


def create_fake_client():
    """Create an async fake Redis client."""
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


async def exercise_storage(storage: RedisStorage) -> None:
    """Run the core RedisStorage behavior scenarios."""
    assert await storage.read(["missing"]) == {}

    await storage.write(ROUND_TRIP_STATE)
    data = await storage.read(list(ROUND_TRIP_STATE.keys()))
    assert data == ROUND_TRIP_STATE

    await storage.delete(["key1", "missing"])
    await storage.delete(["key1", "missing"])
    data = await storage.read(list(ROUND_TRIP_STATE.keys()))
    assert "key1" not in data
    assert data == {key: value for key, value in ROUND_TRIP_STATE.items() if key != "key1"}


class TestRedisStorage:
    """Unit tests for RedisStorage using fakeredis."""

    @pytest.mark.asyncio
    async def test_missing_key_omitted(self):
        client = create_fake_client()
        storage = RedisStorage(client=client)

        assert await storage.read(["missing"]) == {}

        await client.aclose()

    @pytest.mark.asyncio
    async def test_write_read_json_round_trip(self):
        client = create_fake_client()
        storage = RedisStorage(client=client)

        await storage.write({"key1": {"count": 5, "message": "héllo 🤖"}})
        data = await storage.read(["key1"])

        assert data == {"key1": {"count": 5, "message": "héllo 🤖"}}
        await client.aclose()

    @pytest.mark.asyncio
    async def test_delete_idempotent(self):
        client = create_fake_client()
        storage = RedisStorage(client=client)

        await storage.write({"key1": {"count": 5}})
        await storage.delete(["key1", "missing"])
        await storage.delete(["key1", "missing"])

        assert await storage.read(["key1", "missing"]) == {}
        await client.aclose()

    @pytest.mark.asyncio
    async def test_key_prefix_applied(self):
        client = create_fake_client()
        storage = RedisStorage(client=client, key_prefix="mybot:")

        await storage.write({"raw/key": {"count": 1}})

        raw_value = await client.get("mybot:raw/key")
        assert raw_value is not None
        assert json.loads(raw_value) == {"count": 1}
        assert await client.get("raw/key") is None
        await client.aclose()

    @pytest.mark.asyncio
    async def test_special_chars_in_keys(self):
        client = create_fake_client()
        storage = RedisStorage(client=client)
        key = "slash/key:colon%percent space🤖"

        await storage.write({key: {"value": "stored"}})
        data = await storage.read([key])

        assert data == {key: {"value": "stored"}}
        await client.aclose()

    @pytest.mark.asyncio
    async def test_empty_object_preserved(self):
        client = create_fake_client()
        storage = RedisStorage(client=client)

        await storage.write({"empty": {}})
        data = await storage.read(["empty"])

        assert data == {"empty": {}}
        await client.aclose()

    @pytest.mark.asyncio
    async def test_nested_objects_and_null_values_preserved(self):
        client = create_fake_client()
        storage = RedisStorage(client=client)
        value = {"nested": {"items": [1, {"value": None}, "🤖"]}, "optional": None}

        await storage.write({"complex": value})
        data = await storage.read(["complex"])

        assert data == {"complex": value}
        await client.aclose()

    @pytest.mark.asyncio
    async def test_aclose_does_not_close_non_owned_client(self):
        client = create_fake_client()
        client.aclose = AsyncMock()
        storage = RedisStorage(client=client)

        await storage.aclose()

        client.aclose.assert_not_awaited()

    def test_import_error_message_when_redis_missing(self):
        real_import = builtins.__import__

        def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
            if name == "redis" or name == "redis.asyncio":
                raise ImportError("No module named redis")
            return real_import(name, globals, locals, fromlist, level)

        with patch("builtins.__import__", side_effect=fake_import):
            with pytest.raises(ImportError, match=re.escape(_INSTALL_HINT)):
                RedisStorage("redis://localhost:6379")

    def test_requires_url_or_client(self):
        with pytest.raises(ValueError, match="Provide either a Redis URL or an existing client"):
            RedisStorage()

    def test_rejects_url_and_client_together(self):
        client = create_fake_client()
        with pytest.raises(ValueError, match="Provide either url OR client, not both"):
            RedisStorage("redis://localhost:6379", client=client)


@pytest.mark.asyncio
async def test_fake_redis_core_scenarios():
    """Run core scenarios against fakeredis."""
    client = create_fake_client()
    storage = RedisStorage(client=client, key_prefix="botas-test:")

    await exercise_storage(storage)
    await client.aclose()


@pytest.mark.skipif(not os.getenv("REDIS_URL"), reason="REDIS_URL not set")
@pytest.mark.asyncio
async def test_real_redis_core_scenarios():
    """Run core scenarios against a real Redis connection when REDIS_URL is set."""
    prefix = f"botas-test:{uuid.uuid4()}:"
    storage = RedisStorage(os.environ["REDIS_URL"], key_prefix=prefix)

    try:
        await exercise_storage(storage)
    finally:
        await storage.delete(list(ROUND_TRIP_STATE.keys()))
        await storage.aclose()
