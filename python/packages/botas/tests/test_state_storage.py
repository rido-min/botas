"""Tests for Storage implementations (MemoryStorage and FileStorage)."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from botas.state import FileStorage, MemoryStorage


class TestMemoryStorage:
    """Tests for MemoryStorage."""

    @pytest.mark.asyncio
    async def test_read_write_round_trip(self):
        storage = MemoryStorage()
        await storage.write({"key1": {"count": 5}})
        data = await storage.read(["key1"])
        assert data == {"key1": {"count": 5}}

    @pytest.mark.asyncio
    async def test_read_missing_key(self):
        storage = MemoryStorage()
        data = await storage.read(["missing"])
        assert data == {}

    @pytest.mark.asyncio
    async def test_delete(self):
        storage = MemoryStorage()
        await storage.write({"key1": {"count": 5}})
        await storage.delete(["key1"])
        data = await storage.read(["key1"])
        assert data == {}

    @pytest.mark.asyncio
    async def test_delete_idempotent(self):
        storage = MemoryStorage()
        await storage.delete(["missing"])  # Should not raise

    @pytest.mark.asyncio
    async def test_write_updates_existing(self):
        storage = MemoryStorage()
        await storage.write({"key1": {"count": 5}})
        await storage.write({"key1": {"count": 10}})
        data = await storage.read(["key1"])
        assert data == {"key1": {"count": 10}}


class TestFileStorage:
    """Tests for FileStorage."""

    @pytest.mark.asyncio
    async def test_read_write_round_trip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = FileStorage(tmpdir)
            await storage.write({"key1": {"count": 5}})
            data = await storage.read(["key1"])
            assert data == {"key1": {"count": 5}}

    @pytest.mark.asyncio
    async def test_read_missing_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = FileStorage(tmpdir)
            data = await storage.read(["missing"])
            assert data == {}

    @pytest.mark.asyncio
    async def test_delete(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = FileStorage(tmpdir)
            await storage.write({"key1": {"count": 5}})
            await storage.delete(["key1"])
            data = await storage.read(["key1"])
            assert data == {}

    @pytest.mark.asyncio
    async def test_delete_idempotent(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = FileStorage(tmpdir)
            await storage.delete(["missing"])  # Should not raise

    @pytest.mark.asyncio
    async def test_key_sanitization(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = FileStorage(tmpdir)
            # Key with special chars that need encoding
            key = "msteams/bot-id/conversations/conv:123"
            await storage.write({key: {"count": 5}})
            data = await storage.read([key])
            assert data == {key: {"count": 5}}

    @pytest.mark.asyncio
    async def test_long_teams_conversation_key(self):
        """Test that long Teams conversation IDs work on Windows (MAX_PATH > 260)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = FileStorage(tmpdir)
            # Real Teams conversation key that triggered the bug
            key = (
                "msteams/28:a46e4398-dbcb-4107-85e5-a8611a794958/conversations/"
                "a:1t_vf556eJFtnbZeW8p6uf8FvivJrmstnQrNeFQVQhwbMAA09Ux_RdJaigXkt7oqASGR0IaAN7GjDL1lFM_p3Qbgfibz-"
                "7zApXCbxgqo85uMphAlnVyI6YaAs5HRNR7BW"
            )
            test_value = {"turn_count": 42}

            # Write should succeed even if path > 260 chars (Windows MAX_PATH)
            await storage.write({key: test_value})

            # Read should succeed
            data = await storage.read([key])
            assert data == {key: test_value}

            # Delete should succeed
            await storage.delete([key])
            data = await storage.read([key])
            assert data == {}

    @pytest.mark.asyncio
    async def test_creates_parent_dirs(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            nested_path = Path(tmpdir) / "nested" / "path"
            storage = FileStorage(nested_path)
            await storage.write({"key1": {"count": 5}})
            assert nested_path.exists()
            data = await storage.read(["key1"])
            assert data == {"key1": {"count": 5}}
