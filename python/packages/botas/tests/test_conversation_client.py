"""Tests for conversation_client P2 security fixes."""

from unittest.mock import AsyncMock, patch

import pytest

from botas.conversation_client import ConversationClient
from botas.core_activity import CoreActivity


class TestPathParameterEncoding:
    """Issue #115: All path parameters must be URL-encoded."""

    @pytest.mark.asyncio
    async def test_update_activity_encodes_activity_id(self):
        """activity_id with special chars should be URL-encoded."""
        client = ConversationClient()

        with patch.object(client._http, "put", new_callable=AsyncMock) as mock_put:
            mock_put.return_value = {"id": "response-id"}

            await client.update_activity_async(
                "https://example.com",
                "conv-123",
                "1234/5678",
                CoreActivity(type="message", text="updated"),
            )

            endpoint = mock_put.call_args[0][1]
            assert "1234%2F5678" in endpoint

    @pytest.mark.asyncio
    async def test_delete_activity_encodes_activity_id(self):
        """activity_id with query chars should be URL-encoded."""
        client = ConversationClient()

        with patch.object(client._http, "delete", new_callable=AsyncMock) as mock_delete:
            await client.delete_activity_async("https://example.com", "conv-123", "abc?xyz")

            endpoint = mock_delete.call_args[0][1]
            assert "abc%3Fxyz" in endpoint

    @pytest.mark.asyncio
    async def test_get_conversation_member_encodes_member_id(self):
        """member_id with special chars should be URL-encoded."""
        client = ConversationClient()

        with patch.object(client._http, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {"id": "user/123#abc", "name": "Test"}

            await client.get_conversation_member_async("https://example.com", "conv-123", "user/123#abc")

            endpoint = mock_get.call_args[0][1]
            assert "user%2F123%23abc" in endpoint

    @pytest.mark.asyncio
    async def test_delete_conversation_member_encodes_member_id(self):
        """member_id with ampersand should be URL-encoded."""
        client = ConversationClient()

        with patch.object(client._http, "delete", new_callable=AsyncMock) as mock_delete:
            await client.delete_conversation_member_async("https://example.com", "conv-123", "user&admin")

            endpoint = mock_delete.call_args[0][1]
            assert "user%26admin" in endpoint
